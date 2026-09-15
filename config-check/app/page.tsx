export default function Home({
  searchParams,
}: {
  searchParams: { error?: string; detail?: string };
}) {
  const slug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
  const installUrl = `https://github.com/apps/${slug}/installations/new`;

  return (
    <main style={{ padding: 48, fontFamily: "sans-serif", maxWidth: 560 }}>
      <h1>Config Check</h1>
      <p>
        Catch a missing environment variable before it breaks a deploy — the
        check runs inside your own GitHub Actions and GCP project. We never
        see your secrets, only pass/fail results.
      </p>

      {searchParams.error && (
        <div
          style={{
            marginTop: 16,
            marginBottom: 16,
            padding: 12,
            background: "#2a1414",
            border: "1px solid #5a2a2a",
            borderRadius: 6,
            color: "#f2a5a5",
          }}
        >
          <strong>Connection failed:</strong> {searchParams.error}
          {searchParams.detail && <div style={{ marginTop: 4, opacity: 0.85 }}>{searchParams.detail}</div>}
        </div>
      )}

      
        href={installUrl}
        style={{
          display: "inline-block",
          marginTop: 16,
          padding: "10px 20px",
          background: "#238636",
          color: "white",
          borderRadius: 6,
          textDecoration: "none",
        }}
      >
        Connect GitHub →
      </a>
    </main>
  );
}