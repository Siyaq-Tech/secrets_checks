import { NextRequest, NextResponse } from "next/server";
import { githubApp } from "@/lib/github";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const installationId = req.nextUrl.searchParams.get("installation_id");
  if (!installationId) {
    return NextResponse.redirect(new URL("/?error=missing_installation", req.url));
  }

  try {
    const octokit = await githubApp.getInstallationOctokit(Number(installationId));
    const { data: installation } = await octokit.request(
      "GET /app/installations/{installation_id}",
      { installation_id: Number(installationId) }
    );

    const account = installation.account as { login?: string; type?: string } | null;

    await prisma.installation.upsert({
      where: { githubInstallationId: Number(installationId) },
      update: {},
      create: {
        githubInstallationId: Number(installationId),
        accountLogin: account?.login ?? "unknown",
        accountType: account?.type ?? "unknown",
      },
    });

    return NextResponse.redirect(
      new URL(`/connect?installation_id=${installationId}`, req.url)
    );
  } catch (err) {
    // Logged server-side so it shows up in Vercel's function logs with a
    // stack trace, instead of the request just dying as a bare 500.
    console.error("GitHub App callback failed:", err);

    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.redirect(
      new URL(`/?error=callback_failed&detail=${encodeURIComponent(message)}`, req.url)
    );
  }
}