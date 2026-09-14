import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getInstallationOctokit } from "@/lib/github";
import { prisma } from "@/lib/db";
import { buildCallerYaml } from "@/lib/yaml";
import { encryptSecretForRepo } from "@/lib/secrets";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { installationId, repoFullName, config } = body as {
    installationId: string;
    repoFullName: string;
    config: Record<string, string>;
  };

  if (!installationId || !repoFullName) {
    return NextResponse.json({ error: "missing installationId or repoFullName" }, { status: 400 });
  }

  const installation = await prisma.installation.findUnique({
    where: { githubInstallationId: Number(installationId) },
  });
  if (!installation) {
    return NextResponse.json({ error: "unknown installation" }, { status: 404 });
  }

  const octokit = await getInstallationOctokit(Number(installationId));
  const [owner, repo] = repoFullName.split("/");

  // 1. Issue a fresh per-repo token and record the connection. This token
  //    is the ONLY credential the customer's own workflow ever receives —
  //    it can only submit reports, nothing else.
  const apiToken = randomBytes(24).toString("hex");

  await prisma.connectedRepo.upsert({
    where: { repoFullName },
    update: { config, apiToken },
    create: {
      repoFullName,
      config,
      apiToken,
      installationId: installation.id,
    },
  });

  // 2. Write (or update) the caller workflow file in the target repo.
  const path = ".github/workflows/validate-configuration.yml";
  let yamlContent: string;
  try {
    yamlContent = buildCallerYaml(config);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid config" },
      { status: 400 }
    );
  }

  let existingSha: string | undefined;
  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      { owner, repo, path }
    );
    if (!Array.isArray(data)) existingSha = data.sha;
  } catch {
    // File doesn't exist yet — first install, nothing to do here.
  }

  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path,
    message: existingSha
      ? "Update Configuration Validation workflow"
      : "Add Configuration Validation workflow",
    content: Buffer.from(yamlContent).toString("base64"),
    sha: existingSha,
  });

  // 3. Provision the secret the workflow needs to report back to us.
  const { data: publicKey } = await octokit.request(
    "GET /repos/{owner}/{repo}/actions/secrets/public-key",
    { owner, repo }
  );
  const encryptedValue = await encryptSecretForRepo(publicKey.key, apiToken);

  await octokit.request(
    "PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}",
    {
      owner,
      repo,
      secret_name: "CONFIG_CHECK_API_TOKEN",
      encrypted_value: encryptedValue,
      key_id: publicKey.key_id,
    }
  );

  return NextResponse.json({ ok: true });
}
