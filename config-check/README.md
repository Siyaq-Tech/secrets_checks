# Config Check — starter

A minimal, real, deployable version of the "connect a repo, generate the
workflow, see pass/fail on a dashboard, get notified wherever you want"
product. It never touches a customer's GCP credentials or secret values —
the actual check keeps running inside their own GitHub Actions, using
their own GCP identity. This app only writes the workflow file, and
receives the redacted, key-names-only report back.

## What's here

- `app/page.tsx` — landing page with the "Connect GitHub" install link
- `app/connect` — form: pick a repo, fill in config, installs the workflow
- `app/notifications` — add/remove where a repo's reports get sent
- `app/dashboard` — table of connected repos + latest check status
- `app/api/github/callback` — GitHub redirects here after App install
- `app/api/repos` — lists repos the installation can see
- `app/api/generate-yaml` — writes the caller YAML + provisions its secret
- `app/api/report` — where the customer's own workflow run reports back,
  and fans the result out to that repo's notification channels
- `app/api/notification-channels` — CRUD for a repo's notification channels
- `lib/notify.ts` — the four senders (Zoho Cliq, generic webhook, email, WhatsApp)
- `lib/validate.ts` — the input checks everything above relies on (see
  "Security notes" below — this is the part most worth reading carefully)
- `prisma/schema.prisma` — 4 tables: installations, connected repos,
  reports, notification channels

## 1. Register the GitHub App

This has to happen before any of the code above can actually run.

1. Go to **github.com/settings/apps/new** (or your org's equivalent).
2. **Homepage URL**: your future deployed URL (fill in after step 5 if you don't have it yet — you can edit this later).
3. **Callback URL**: `https://<your-app>/api/github/callback`
4. **Setup URL** (under "Post installation"): same as callback URL above, and check "Redirect on update".
5. **Webhook**: can leave inactive for this MVP — nothing here reacts to webhooks yet, installs are handled via the callback redirect.
6. **Permissions** → Repository permissions:
   - **Contents**: Read and write (to commit the workflow file)
   - **Secrets**: Read and write (to create `CONFIG_CHECK_API_TOKEN`)
   - **Metadata**: Read-only (mandatory default)
7. **Where can this GitHub App be installed?** → Any account (or "Only this account" if you're testing privately first).
8. Create the App. On its settings page:
   - Note the **App ID** and **Client ID**.
   - Generate a **Client secret**.
   - Generate a **private key** — downloads a `.pem` file.

## 2. Set up the database

Create a free Postgres instance (Neon or Supabase both work) and copy its
connection string into `DATABASE_URL`.

```bash
npx prisma migrate dev --name init
```

## 3. Set up notification providers (all optional, pick what you need)

- **Zoho Cliq / generic webhook** — no platform-level setup needed, the
  user supplies the bot token or URL themselves in the `/notifications` UI.
- **Email** — create a free [Resend](https://resend.com) account, verify
  a sending domain, and set `RESEND_API_KEY` + `RESEND_FROM_EMAIL`.
- **WhatsApp** — set up a [Twilio](https://twilio.com) account and its
  WhatsApp sandbox (or a production WhatsApp sender once approved), then
  set `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_WHATSAPP_FROM`.
  **Read the WhatsApp caveat below before relying on this** — it's the
  heaviest of the four to actually operate.

Any provider left unconfigured just means that channel type fails
silently when someone tries to use it (visible in server logs, not
surfaced to the user yet — see "Known gaps" below).

## 4. Fill in `.env.local`

Copy `.env.example` to `.env.local` and fill in everything from steps 1–3,
plus your database URL. For `GITHUB_APP_PRIVATE_KEY`, open the `.pem`
file and paste its contents in, replacing real line breaks with `\n`.

## 5. Run it locally

```bash
npm install
npm run dev
```

Visit `localhost:3000`, click **Connect GitHub**, install the App on a
test repo, and you should land on `/connect` with that repo selectable.

## 6. Deploy

Push this to its own GitHub repo, import it into Vercel, add the same
environment variables there, and set `PUBLIC_APP_URL` to the real
deployed URL. Then go back to the GitHub App's settings and update the
Callback/Setup URLs to match.

## The WhatsApp caveat

Unlike the other three channels, WhatsApp isn't just "add an API key."
Twilio's sandbox is fine for testing but requires the recipient to
message your sandbox number first to opt in, and free-form messages
outside a 24-hour customer-initiated window generally require a
**pre-approved message template**, not arbitrary text like the report
body this sends today. Going to production means Meta's WhatsApp Business
Platform onboarding (business verification, a real sender number,
template approval) — this is a genuinely heavier operational lift than
the other three channels, not just more code. Budget for that separately
rather than assuming it's a checkbox next to "email."

## Security notes — read before connecting real repos

- **`lib/validate.ts` is the boundary that matters most in this codebase.**
  Config-UI input gets interpolated directly into a YAML file that GitHub
  then *executes*, and webhook URLs cause this server to make outbound
  requests to wherever a user types. Both `buildCallerYaml` and the
  webhook sender validate through this file before doing anything — if
  you add a new config field or channel type, route it through here too,
  don't interpolate raw user input directly.
- **The webhook SSRF guard is basic, not exhaustive.** It blocks the
  obvious private IP ranges and requires `https://`, but doesn't stop DNS
  rebinding or redirects to internal hosts. Fine for an MVP with trusted
  early users; before opening this to the public, route outbound webhook
  requests through an egress proxy or IP allowlist instead of trusting
  this check alone.

## Known gaps — not fixed yet, worth knowing before you rely on this

- **No auth on the API routes or the dashboard.** `/api/generate-yaml`,
  `/api/repos`, `/api/notification-channels`, and `/dashboard` all trust
  whoever calls them — there's no session tied to "this browser is allowed
  to act on this installation." Anyone who knows (or guesses) an
  `installationId` or `repoFullName` can currently read or write through
  these routes. This is the single biggest thing to fix before this goes
  anywhere near real users — add a session layer (e.g. NextAuth with the
  GitHub provider) that ties requests to the installations that user
  actually owns.
- **No webhook handling for uninstall/repo-removal.** If someone
  uninstalls the App or removes a repo from it, nothing here updates the
  database — a `ConnectedRepo` can outlive its actual GitHub access.
- **The GCP-Secret-Manager job doesn't report here yet.** Only the main
  `validate-configuration` job POSTs to `/api/report` (see the workflow
  change below) — the GCP job would need the identical step added.
- **Notification failures are silent to the user.** They're logged
  server-side (`console.error`) but nothing in the UI shows "your Zoho
  channel has been failing for the last 5 runs" — worth a `lastError`
  field on `NotificationChannel` once this matters.

## Required change to the shared reusable workflow

For the report to actually reach this app, `configuration-validation.yml`
in `secrets_checks` needs one new input and one new step — add this
input alongside the existing ones:

```yaml
      platform-report-url:
        type: string
        default: ''
```

And this step, right after the existing "Send report to Zoho Cliq" step
in the `validate-configuration` job:

```yaml
      - name: Report to platform
        if: always()
        env:
          PLATFORM_REPORT_URL: ${{ inputs.platform-report-url }}
          PLATFORM_TOKEN: ${{ secrets.CONFIG_CHECK_API_TOKEN }}
          JOB_STATUS: ${{ steps.validate.outcome }}
        run: |
          set -euo pipefail
          REPORT_FILE="${RUNNER_TEMP}/validation-report.txt"
          if [[ -z "${PLATFORM_REPORT_URL:-}" || -z "${PLATFORM_TOKEN:-}" ]]; then
            exit 0
          fi
          if [[ ! -f "${REPORT_FILE}" ]]; then
            exit 0
          fi
          BODY=$(jq -Rs --arg job "validate-configuration" --arg status "${JOB_STATUS}" \
            '{ jobName: $job, status: $status, reportText: . }' "${REPORT_FILE}")
          curl -sS -X POST "${PLATFORM_REPORT_URL}" \
            -H "Authorization: Bearer ${PLATFORM_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "${BODY}"
```

Both `CLIQ_WEBHOOK_URL` (Zoho, sent directly from the Action) and
`CONFIG_CHECK_API_TOKEN` (this platform, which then fans out to whatever
channels are configured in `/notifications`) can be set at once — they
run side by side, nothing about this replaces the other.
