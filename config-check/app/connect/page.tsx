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

export default function Connect() {
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [repos, setRepos] = useState<string[]>([]);
  const [repo, setRepo] = useState("");
  const [envExamplePath, setEnvExamplePath] = useState(".env_example");
  const [gcpProjectId, setGcpProjectId] = useState("");
  const [gcpWip, setGcpWip] = useState("");
  const [gcpServiceAccount, setGcpServiceAccount] = useState("");
  const [gcpSecretName, setGcpSecretName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("installation_id");
    setInstallationId(id);
    if (id) {
      fetch(`/api/repos?installation_id=${id}`)
        .then((r) => r.json())
        .then((d) => setRepos(d.repos || []));
    }
  }, []);

  async function submit() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/generate-yaml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          repoFullName: repo,
          config: {
            envExamplePath,
            gcpProjectId,
            gcpWip,
            gcpServiceAccount,
            gcpSecretName,
          },
        }),
      });
      setStatus(res.ok ? "Done — check the repo's Actions tab." : "Something went wrong.");
    } catch {
      setStatus("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 48, fontFamily: "sans-serif", maxWidth: 480 }}>
      <h1>Connect a repo</h1>

      <label>Repo</label>
      <select value={repo} onChange={(e) => setRepo(e.target.value)} style={inputStyle}>
        <option value="">Select…</option>
        {repos.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      <label>.env_example path</label>
      <input
        value={envExamplePath}
        onChange={(e) => setEnvExamplePath(e.target.value)}
        style={inputStyle}
      />

      <h3>GCP Secret Manager (optional)</h3>
      <input
        placeholder="GCP project id"
        value={gcpProjectId}
        onChange={(e) => setGcpProjectId(e.target.value)}
        style={inputStyle}
      />
      <input
        placeholder="Workload identity provider"
        value={gcpWip}
        onChange={(e) => setGcpWip(e.target.value)}
        style={inputStyle}
      />
      <input
        placeholder="Service account"
        value={gcpServiceAccount}
        onChange={(e) => setGcpServiceAccount(e.target.value)}
        style={inputStyle}
      />
      <input
        placeholder="Secret name"
        value={gcpSecretName}
        onChange={(e) => setGcpSecretName(e.target.value)}
        style={inputStyle}
      />

      <button onClick={submit} disabled={!repo || saving} style={{ marginTop: 8 }}>
        {saving ? "Saving…" : "Save & install workflow"}
      </button>
      {status && <p>{status}</p>}
    </main>
  );
}
