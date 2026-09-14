import { App } from "@octokit/app";

const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY || "").replace(/\\n/g, "\n");

export const githubApp = new App({
  appId: process.env.GITHUB_APP_ID!,
  privateKey,
  oauth: {
    clientId: process.env.GITHUB_APP_CLIENT_ID!,
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!,
  },
});

// Every call to this issues a short-lived (~1hr) installation token —
// nothing long-lived is ever stored in the database.
export async function getInstallationOctokit(installationId: number) {
  return githubApp.getInstallationOctokit(installationId);
}
