import { App } from "cdktf";
import { config } from "dotenv";
import { IamStack } from "./stacks/iam";
import { OidcStack } from "./stacks/oidc";
import { StorageStack } from "./stacks/storage";
import { env } from "process";

config();

const app = new App();
const { pool } = new OidcStack(app, "bootstrap-oidc");
const { serviceAccount } = new IamStack(app, "bootstrap-iam", {
  workloadIdentityPoolId: pool.name,
  repositoryId: env["REPO_ID"]!
});
new StorageStack(app, "bootstrap-storage", {
  saEmail: serviceAccount.email
});

app.synth();
