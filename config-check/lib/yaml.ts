import { assertSafeYamlValue } from "@/lib/validate";

type RepoConfig = {
  branch?: string;
  environment?: string;
  envExamplePath?: string;
  gcpProjectId?: string;
  gcpWip?: string;
  gcpServiceAccount?: string;
  gcpSecretName?: string;
};

export function buildCallerYaml(config: RepoConfig): string {
  const sharedRepo = process.env.SHARED_WORKFLOW_REPO;
  const sharedRef = process.env.SHARED_WORKFLOW_REF || "main";
  const reportUrl = `${process.env.PUBLIC_APP_URL}/api/report`;

  const branch = config.branch || "main";
  const environment = config.environment || "production";
  const envExamplePath = config.envExamplePath || ".env_example";

  assertSafeYamlValue(branch, "branch");
  assertSafeYamlValue(environment, "environment");
  assertSafeYamlValue(envExamplePath, ".env_example path");

  let gcpBlock = "";
  if (config.gcpProjectId) {
    const gcpProjectId = config.gcpProjectId;
    const gcpWip = config.gcpWip || "";
    const gcpServiceAccount = config.gcpServiceAccount || "";
    const gcpSecretName = config.gcpSecretName || "";

    assertSafeYamlValue(gcpProjectId, "GCP project id");
    assertSafeYamlValue(gcpWip, "workload identity provider");
    assertSafeYamlValue(gcpServiceAccount, "service account");
    assertSafeYamlValue(gcpSecretName, "GCP secret name");

    gcpBlock = `      gcp-project-id: '${gcpProjectId}'
      gcp-workload-identity-provider: '${gcpWip}'
      gcp-service-account: '${gcpServiceAccount}'
      gcp-secret-name: '${gcpSecretName}'
`;
  }

  return `name: Configuration Validation

on:
  push:
    branches: [${branch}]
  workflow_dispatch:

jobs:
  validate:
    uses: ${sharedRepo}/.github/workflows/configuration-validation.yml@${sharedRef}
    secrets: inherit
    permissions:
      contents: read
      id-token: write
    with:
      environment: ${environment}
      env-example-path: '${envExamplePath}'
${gcpBlock}      platform-report-url: '${reportUrl}'
`;
}
