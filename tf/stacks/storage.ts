import { GoogleProvider } from "@cdktf/provider-google/lib/provider";
import { GcsBackend, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { env } from "process";
import { StorageBucket } from "@cdktf/provider-google/lib/storage-bucket";
import { StorageBucketIamBinding } from "@cdktf/provider-google/lib/storage-bucket-iam-binding";

type StorageStackProps = {
    saEmail: string;
}

export class StorageStack extends TerraformStack {
    constructor(scope: Construct, id: string, { saEmail }: StorageStackProps) {
        super(scope, id);

        new GcsBackend(this, {
            bucket: env["GCP_BUCKET"]!,
            prefix: "tf/storage/state"
          });
      
        const provider = new GoogleProvider(this, "provider", {
            project: env["GCP_PROJECT"],
            region: env["GCP_REGION"]
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