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
  repositoryId: string;
}

export class IamStack extends TerraformStack {
  public serviceAccount: ServiceAccount;

  constructor(scope: Construct, id: string, { workloadIdentityPoolId, repositoryId }: IamStackProps) {
    super(scope, id);

    new GcsBackend(this, {
      bucket: env["GCP_BUCKET"]!!,
      prefix: "tf/iam/state"
    });

    const provider = new GoogleProvider(this, "provider", {
      project: env["GCP_PROJECT"],
      region: env["GCP_REGION"]
    });

    this.serviceAccount = new ServiceAccount(this, "deployer-sa", {
      accountId: "github-deployer",
      displayName: "Github deployer",
      description: "Is assumed by Github actions runners to deploy a stack"
    });

    const role = new ProjectIamCustomRole(this, "deployer-role", {
      roleId: "stack.deployer",
      title: "Stack deployer",
      description: "Set of permissions needed to deploy a stack on GCP",
      stage: "GA",
      permissions,
    });

    new ProjectIamBinding(this, "deployer-sa-role-binding", {
      project: provider.project!!,
      members: [`serviceAccount:${this.serviceAccount.email}`],
      role: role.id
    });

    new ServiceAccountIamBinding(this, 'sa-pool-binding', {
      members: [`principalSet://iam.googleapis.com/${workloadIdentityPoolId}/attribute.repository/${repositoryId}`],
      role: "roles/iam.workloadIdentityUser",
      serviceAccountId: this.serviceAccount.name
    });
  }
}
