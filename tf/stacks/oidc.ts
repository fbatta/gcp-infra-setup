import { env } from "process";
import { GcsBackend, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { IamWorkloadIdentityPool } from "@cdktf/provider-google/lib/iam-workload-identity-pool";
import { IamWorkloadIdentityPoolProvider } from "@cdktf/provider-google/lib/iam-workload-identity-pool-provider";
import { GoogleProvider } from "@cdktf/provider-google/lib/provider";

type OidcStackProps = {
    provider: GoogleProvider;
}

export class OidcStack extends TerraformStack {
    public pool: IamWorkloadIdentityPool;
    private provider: GoogleProvider;

    constructor(scope: Construct, id: string, { provider }: OidcStackProps) {
        super(scope, id);

        this.provider = provider;

        new GcsBackend(this, {
            bucket: env["GCP_BUCKET"]!!,
            prefix: `tf/${this.provider.project}/oidc/state`
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