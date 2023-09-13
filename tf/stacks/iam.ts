import { Construct } from "constructs";
import { env } from "process";
import { TerraformStack, GcsBackend } from "cdktf";
import { GoogleProvider } from "@cdktf/provider-google/lib/provider";
import { ProjectIamBinding } from "@cdktf/provider-google/lib/project-iam-binding";
import { ServiceAccountIamBinding } from "@cdktf/provider-google/lib/service-account-iam-binding";
import { ServiceAccount } from "@cdktf/provider-google/lib/service-account";
import { ProjectIamCustomRole } from "@cdktf/provider-google/lib/project-iam-custom-role";
import * as permissions from "../resources/iam/deployer-role-permissions.json";

type IamStackProps = {
  workloadIdentityPoolId: string;
  repositoryIds: string;
  provider: GoogleProvider;
}

export class IamStack extends TerraformStack {
  public serviceAccount: ServiceAccount;
  private provider: GoogleProvider;

  constructor(scope: Construct, id: string, { workloadIdentityPoolId, repositoryIds, provider }: IamStackProps) {
    super(scope, id);

    this.provider = provider;

    new GcsBackend(this, {
      bucket: env["GCP_BUCKET"]!,
      prefix: `tf/${this.provider.project}/iam/state`
    });

    this.serviceAccount = new ServiceAccount(this, "deployer-sa", {
      accountId: "github-deployer",
      displayName: "Github deployer",
      description: "Is assumed by Github actions runners to deploy a stack"
    });

    const role = new ProjectIamCustomRole(this, "deployer-role", {
      roleId: "github.deployer",
      title: "Github deployer",
      description: "Set of permissions needed to deploy a stack through GH actions on GCP",
      stage: "GA",
      permissions,
    });

    new ProjectIamBinding(this, "deployer-sa-role-binding", {
      project: provider.project!!,
      members: [`serviceAccount:${this.serviceAccount.email}`],
      role: role.id
    });

    new ServiceAccountIamBinding(this, 'sa-pool-binding', {
      // GH doesn't support array inputs, so we let the user specify a comma-separated list,
      // then we split it and trim any whitespace, and finally map it to the strings we need
      members: repositoryIds.split(",")
        .map((entry) => entry.trim())
        .map((entry) => `principalSet://iam.googleapis.com/${workloadIdentityPoolId}/attribute.repository/${entry}`),
      role: "roles/iam.workloadIdentityUser",
      serviceAccountId: this.serviceAccount.name
    });
  }
}
