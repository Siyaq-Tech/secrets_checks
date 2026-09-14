"use client";

import { useEffect, useState } from "react";

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 8,
  marginBottom: 10,
  background: "#16161c",
  color: "#e8e8ea",
  border: "1px solid #2a2a33",
  borderRadius: 6,
};

type Channel = {
  id: string;
  type: string;
  config: Record<string, string>;
  enabled: boolean;
};

const CHANNEL_LABELS: Record<string, string> = {
  zoho_cliq: "Zoho Cliq",
  webhook: "Webhook",
  email: "Email",
  whatsapp: "WhatsApp",
};

function summarize(channel: Channel): string {
  switch (channel.type) {
    case "zoho_cliq":
      return `bot: ${channel.config.botName}`;
    case "webhook":
      return channel.config.url;
    case "email":
      return channel.config.to;
    case "whatsapp":
      return channel.config.to;
    default:
      return "";
  }
}

export default function Notifications() {
  const [repo, setRepo] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [type, setType] = useState("zoho_cliq");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("repo");
    if (r) {
      setRepo(r);
      loadChannels(r);
    }
  }, []);

  async function loadChannels(repoFullName: string) {
    const res = await fetch(`/api/notification-channels?repo=${encodeURIComponent(repoFullName)}`);
    const data = await res.json();
    setChannels(data.channels || []);
  }

  async function addChannel() {
    setStatus("Saving…");
    const res = await fetch("/api/notification-channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoFullName: repo, type, config: fields }),
    });
    const data = await res.json();
    if (res.ok) {
      setFields({});
      setStatus(null);
      loadChannels(repo);
    } else {
      setStatus(data.error || "Something went wrong.");
    }
  }

  async function removeChannel(id: string) {
    await fetch(`/api/notification-channels?id=${id}`, { method: "DELETE" });
    loadChannels(repo);
  }

  function field(key: string, placeholder: string) {
    return (
      <input
        key={key}
        placeholder={placeholder}
        value={fields[key] || ""}
        onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
        style={inputStyle}
      />
    );
  }

  return (
    <main style={{ padding: 48, fontFamily: "sans-serif", maxWidth: 480 }}>
      <h1>Notifications</h1>
      <p style={{ opacity: 0.7 }}>{repo || "No repo selected — open this page from the dashboard."}</p>

      <h3>Connected channels</h3>
      {channels.length === 0 && <p style={{ opacity: 0.7 }}>None yet.</p>}
      {channels.map((c) => (
        <div
          key={c.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: 8,
            border: "1px solid #2a2a33",
            borderRadius: 6,
            marginBottom: 8,
          }}
        >
          <span>
            <strong>{CHANNEL_LABELS[c.type] || c.type}</strong> — {summarize(c)}
          </span>
          <button onClick={() => removeChannel(c.id)}>Remove</button>
        </div>
      ))}

      <h3 style={{ marginTop: 24 }}>Add a channel</h3>
      <label>Type</label>
      <select
        value={type}
        onChange={(e) => {
          setType(e.target.value);
          setFields({});
        }}
        style={inputStyle}
      >
        <option value="zoho_cliq">Zoho Cliq</option>
        <option value="webhook">Webhook (Slack, Teams, Jira, etc.)</option>
        <option value="email">Email</option>
        <option value="whatsapp">WhatsApp</option>
      </select>

      {type === "zoho_cliq" && (
        <>
          {field("botName", "Bot unique name")}
          {field("webhookToken", "Webhook token (zapikey)")}
        </>
      )}
      {type === "webhook" && field("url", "https://…")}
      {type === "email" && field("to", "you@company.com")}
      {type === "whatsapp" && field("to", "+15551234567")}

      <button onClick={addChannel} disabled={!repo} style={{ marginTop: 8 }}>
        Add channel
      </button>
      {status && <p>{status}</p>}
    </main>
  );
}
