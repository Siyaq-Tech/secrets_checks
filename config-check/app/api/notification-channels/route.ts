import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSafeWebhookUrl, isValidEmail, isValidPhoneE164 } from "@/lib/validate";

function validateChannelConfig(type: string, config: any): string | null {
  switch (type) {
    case "zoho_cliq":
      if (!config?.botName || !config?.webhookToken) return "botName and webhookToken are required";
      return null;
    case "webhook":
      if (!config?.url || !isSafeWebhookUrl(config.url)) return "a valid https:// url is required";
      return null;
    case "email":
      if (!config?.to || !isValidEmail(config.to)) return "a valid email address is required";
      return null;
    case "whatsapp":
      if (!config?.to || !isValidPhoneE164(config.to)) return "a valid phone number in +1234567890 format is required";
      return null;
    default:
      return `unknown channel type: ${type}`;
  }
}

export async function GET(req: NextRequest) {
  const repoFullName = req.nextUrl.searchParams.get("repo");
  if (!repoFullName) return NextResponse.json({ channels: [] });

  const repo = await prisma.connectedRepo.findUnique({
    where: { repoFullName },
    include: { notificationChannels: true },
  });

  return NextResponse.json({ channels: repo?.notificationChannels ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { repoFullName, type, config } = body as {
    repoFullName: string;
    type: string;
    config: Record<string, string>;
  };

  if (!repoFullName || !type) {
    return NextResponse.json({ error: "repoFullName and type are required" }, { status: 400 });
  }

  const validationError = validateChannelConfig(type, config);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const repo = await prisma.connectedRepo.findUnique({ where: { repoFullName } });
  if (!repo) {
    return NextResponse.json({ error: "repo not connected yet" }, { status: 404 });
  }

  const channel = await prisma.notificationChannel.create({
    data: { repoId: repo.id, type, config },
  });

  return NextResponse.json({ channel });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await prisma.notificationChannel.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
