import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendNotifications } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "missing token" }, { status: 401 });
  }

  const repo = await prisma.connectedRepo.findUnique({
    where: { apiToken: token },
    include: { notificationChannels: { where: { enabled: true } } },
  });
  if (!repo) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const body = await req.json();
  const { jobName, status, reportText } = body as {
    jobName: string;
    status: string;
    reportText: string;
  };

  await prisma.report.create({
    data: { repoId: repo.id, jobName, status, reportText },
  });

  // Best-effort fan-out — a slow/failing channel never delays or fails
  // this response, since the report is already safely recorded above.
  if (repo.notificationChannels.length > 0) {
    sendNotifications(repo.notificationChannels, {
      repoFullName: repo.repoFullName,
      jobName,
      status,
      reportText,
    }).catch((err) => console.error("notification dispatch error:", err));
  }

  return NextResponse.json({ ok: true });
}
