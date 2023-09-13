import { GoogleProvider } from "@cdktf/provider-google/lib/provider";
import { GcsBackend, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { env } from "process";
import { StorageBucket } from "@cdktf/provider-google/lib/storage-bucket";
import { StorageBucketIamBinding } from "@cdktf/provider-google/lib/storage-bucket-iam-binding";

type StorageStackProps = {
    saEmail: string;
    provider: GoogleProvider;
}

export class StorageStack extends TerraformStack {
    private provider: GoogleProvider;

    constructor(scope: Construct, id: string, { saEmail, provider }: StorageStackProps) {
        super(scope, id);

        this.provider = provider;

        new GcsBackend(this, {
            bucket: env["GCP_BUCKET"]!,
            prefix: `tf/${this.provider.project}/storage/state`
          });

        const bucket = new StorageBucket(this, "stack-bucket", {
            location: provider.region!,
            name: `${provider.project}-deployment-stack`,
            uniformBucketLevelAccess: true
        });

        new StorageBucketIamBinding(this, "stack-bucket-iam-binding", {
            bucket: bucket.name,
            role: "roles/storage.objectAdmin",
            members: [
                `serviceAccount:${saEmail}`
            ]
        });
    }
}