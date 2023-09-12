import { App } from "cdktf";
import { config } from "dotenv";
import { IamStack } from "./stacks/iam";
import { OidcStack } from "./stacks/oidc";
import { StorageStack } from "./stacks/storage";

config();

const app = new App();
const { pool } = new OidcStack(app, "bootstrap-oidc");
const { serviceAccount } = new IamStack(app, "bootstrap-iam", {
  workloadIdentityPoolId: pool.name,
  repositoryId: "fbatta/gcp-infra-bootstrap"
});
new StorageStack(app, "bootstrap-storage", {
  saEmail: serviceAccount.email
});

app.synth();
