import { GoogleProvider } from "@cdktf/provider-google/lib/provider";
import { env } from "process";
import { GcsBackend, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { IamWorkloadIdentityPool } from "@cdktf/provider-google/lib/iam-workload-identity-pool";
import { IamWorkloadIdentityPoolProvider } from "@cdktf/provider-google/lib/iam-workload-identity-pool-provider";

export class OidcStack extends TerraformStack {
    public pool: IamWorkloadIdentityPool;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        new GcsBackend(this, {
            bucket: env["GCP_BUCKET"]!!,
            prefix: "tf/oidc/state"
          });
      
        new GoogleProvider(this, "provider", {
            project: env["GCP_PROJECT"],
            region: env["GCP_REGION"]
        });

        this.pool = new IamWorkloadIdentityPool(this, "workload-identity-pool", {
            workloadIdentityPoolId: "gh-pool",
            displayName: "Github pool",
        });

        new IamWorkloadIdentityPoolProvider(this, 'github-provider', {
            workloadIdentityPoolId: this.pool.workloadIdentityPoolId,
            workloadIdentityPoolProviderId: "gh-provider",
            displayName: "Github",
            attributeMapping: {
                "google.subject": "assertion.sub",
                "attribute.actor": "assertion.actor",
                "attribute.repository": "assertion.repository"
            },
            oidc: {
                issuerUri: "https://token.actions.githubusercontent.com"
            }
        });
    }
}