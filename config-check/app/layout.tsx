export const metadata = {
  title: "Config Check",
  description: "Catch missing config before it breaks a deploy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0b0b0f", color: "#e8e8ea" }}>
        {children}
      </body>
    </html>
  );
}
