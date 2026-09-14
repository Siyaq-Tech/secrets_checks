// Values here get interpolated directly into a YAML file that GitHub then
// EXECUTES as a workflow, or used to make server-side HTTP requests — so
// these aren't cosmetic checks, they're the boundary that stops a crafted
// input from breaking the YAML (or worse, injecting into it) or turning
// the notification webhook into a way to probe internal network addresses.

// Allowlist for anything that gets dropped into the generated YAML as a
// bare 'key: value' — GCP resource identifiers, file paths, branch names.
// No quotes, no newlines, no YAML special characters.
const SAFE_YAML_VALUE = /^[A-Za-z0-9_\-./:]+$/;

export function isSafeYamlValue(value: string): boolean {
  return value.length > 0 && value.length <= 512 && SAFE_YAML_VALUE.test(value);
}

export function assertSafeYamlValue(value: string, fieldName: string): void {
  if (!isSafeYamlValue(value)) {
    throw new Error(
      `${fieldName} contains characters that aren't safe to put in a workflow file`
    );
  }
}

// Basic SSRF guard for user-supplied webhook URLs. This is NOT exhaustive
// (doesn't stop DNS rebinding, redirects to internal hosts, etc.) — for
// production, route these requests through an egress proxy or allowlist
// instead of trusting this check alone.
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./, // cloud metadata endpoints live here
  /^\[?::1\]?$/,
];

export function isSafeWebhookUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return !PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

// E.164 — a leading + then 8 to 15 digits, no spaces or punctuation.
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
export function isValidPhoneE164(value: string): boolean {
  return E164_PATTERN.test(value);
}
