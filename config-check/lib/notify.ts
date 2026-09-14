import { isSafeWebhookUrl } from "@/lib/validate";

type ReportPayload = {
  repoFullName: string;
  jobName: string;
  status: string;
  reportText: string;
};

type Channel = {
  id: string;
  type: string;
  config: unknown;
};

function icon(status: string) {
  return status === "success" ? "✅" : "❌";
}

function title(payload: ReportPayload) {
  return `${icon(payload.status)} ${payload.jobName} — ${payload.repoFullName}`;
}

async function sendZohoCliq(config: any, payload: ReportPayload) {
  const { botName, webhookToken } = config;
  if (!botName || !webhookToken) throw new Error("missing botName/webhookToken");

  const url = `https://cliq.zoho.com/api/v2/bots/${botName}/incoming?zapikey=${webhookToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `${title(payload)}\n\`\`\`\n${payload.reportText}\n\`\`\``,
    }),
  });
  if (!res.ok) throw new Error(`Zoho Cliq responded ${res.status}`);
}

async function sendWebhook(config: any, payload: ReportPayload) {
  const { url } = config;
  if (!url) throw new Error("missing url");
  if (!isSafeWebhookUrl(url)) throw new Error("webhook url failed safety check");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`webhook responded ${res.status}`);
}

async function sendEmail(config: any, payload: ReportPayload) {
  const { to } = config;
  if (!to) throw new Error("missing recipient");

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("email sending isn't configured on the platform");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: title(payload),
      text: payload.reportText,
    }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
}

async function sendWhatsApp(config: any, payload: ReportPayload) {
  const { to } = config;
  if (!to) throw new Error("missing recipient");

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) throw new Error("WhatsApp sending isn't configured on the platform");

  const body = new URLSearchParams({
    From: `whatsapp:${from}`,
    To: `whatsapp:${to}`,
    // WhatsApp messages outside an open conversation window generally need
    // to use a pre-approved template, not free-form text — see the note
    // in the README before relying on this in production.
    Body: `${title(payload)}\n\n${payload.reportText}`.slice(0, 1500),
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );
  if (!res.ok) throw new Error(`Twilio responded ${res.status}`);
}

const SENDERS: Record<string, (config: any, payload: ReportPayload) => Promise<void>> = {
  zoho_cliq: sendZohoCliq,
  webhook: sendWebhook,
  email: sendEmail,
  whatsapp: sendWhatsApp,
};

// Fans a report out to every enabled channel independently — one channel
// failing (bad token, provider outage, whatever) never blocks the others,
// and never blocks the report itself from being recorded.
export async function sendNotifications(channels: Channel[], payload: ReportPayload) {
  const results = await Promise.allSettled(
    channels.map(async (channel) => {
      const sender = SENDERS[channel.type];
      if (!sender) throw new Error(`unknown channel type: ${channel.type}`);
      await sender(channel.config, payload);
    })
  );

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      // Best-effort logging only — a production version would want this
      // surfaced in the dashboard per-channel, not just server logs.
      console.error(`notification failed for channel ${channels[i].id}:`, result.reason);
    }
  });
}
