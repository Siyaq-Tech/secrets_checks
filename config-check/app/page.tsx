export default function Home() {
  const installUrl = "https://github.com/apps/secret-check/installations/new";

  return (
    <main style={{ padding: 48, fontFamily: "sans-serif", maxWidth: 560 }}>
      <h1>Config Check</h1>
      <p>
        Catch a missing environment variable before it breaks a deploy — the
        check runs inside your own GitHub Actions and GCP project. We never
        see your secrets, only pass/fail results.
      </p>
      <a
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
