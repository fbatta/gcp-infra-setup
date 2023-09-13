import { App } from "cdktf";
import { config } from "dotenv";
import { IamStack } from "./stacks/iam";
import { OidcStack } from "./stacks/oidc";
import { StorageStack } from "./stacks/storage";
import { env } from "process";
import { GoogleProvider } from "@cdktf/provider-google/lib/provider";

config();

const app = new App();

const provider = new GoogleProvider(app, "provider", {
  project: env["GCP_PROJECT"],
  region: env["GCP_REGION"]
});

const { pool } = new OidcStack(app, "bootstrap-oidc", {
  provider
});
const { serviceAccount } = new IamStack(app, "bootstrap-iam", {
  workloadIdentityPoolId: pool.name,
  repositoryIds: env["REPO_IDS"]!,
  provider
});
new StorageStack(app, "bootstrap-storage", {
  saEmail: serviceAccount.email,
  provider
});

app.synth();
