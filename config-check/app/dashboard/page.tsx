import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const repos = await prisma.connectedRepo.findMany({
    include: { reports: { orderBy: { receivedAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main style={{ padding: 48, fontFamily: "sans-serif", maxWidth: 800 }}>
      <h1>Connected repos</h1>
      {repos.length === 0 && <p>No repos connected yet.</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #2a2a33" }}>
            <th style={{ padding: 8 }}>Repo</th>
            <th style={{ padding: 8 }}>Last status</th>
            <th style={{ padding: 8 }}>Checked</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {repos.map((r: (typeof repos)[number]) => {
            const latest = r.reports[0];
            return (
              <tr key={r.id} style={{ borderBottom: "1px solid #1c1c22" }}>
                <td style={{ padding: 8 }}>{r.repoFullName}</td>
                <td style={{ padding: 8 }}>
                  {latest ? (latest.status === "success" ? "✅ pass" : "❌ fail") : "—"}
                </td>
                <td style={{ padding: 8 }}>
                  {latest ? new Date(latest.receivedAt).toLocaleString() : "never"}
                </td>
                <td style={{ padding: 8 }}>
                  <a href={`/notifications?repo=${encodeURIComponent(r.repoFullName)}`}>
                    Notifications
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
