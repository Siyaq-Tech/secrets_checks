import { NextRequest, NextResponse } from "next/server";
import { getInstallationOctokit } from "@/lib/github";

export async function GET(req: NextRequest) {
  const installationId = req.nextUrl.searchParams.get("installation_id");
  if (!installationId) {
    return NextResponse.json({ repos: [] });
  }

  const octokit = await getInstallationOctokit(Number(installationId));
  const { data } = await octokit.request("GET /installation/repositories");
  const repos = data.repositories.map((r) => r.full_name);

  return NextResponse.json({ repos });
}
