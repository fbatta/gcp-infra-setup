# GCP infrastructure setup

## Bootstrapping

### Prerequisites

- `gcloud` CLI
- `jq` (on macOS, can be installed with `brew install jq`)
- The project ID that you want to target

### Very first run

We will assume that our newly-created GCP project is completely blank. That is, no APIs enabled, no service accounts available etc. etc.

Before we can even run our very first github actions, there's a couple of essential steps we need to perform from our own machine to create the bare minimum that GH will need.

Start by authenticating the `gcloud` CLI with your GCP account by running:

```
gcloud auth login
```

Now, let's run the `create-bootstrap-sa.sh` bash script:

```
sh ./scripts/create-bootstrap-sa.sh project-id region
```

Replace `project-id` and `region` with the relevant values for your project.

### Script result

The previous script will do a bunch of things:

- Enable the IAM API
- Create a new service account called `infra-bootstrap`
- Create a new role called `infra.bootstrap` with the minimal set of permissions needed to run the Terraform stack
- Assign the `infra.bootstrap` role to the `infra-bootstrap` service account **for the next 12 hours**
- Create a new private key for the SA, and download it into a `sa_key.json` file inside this directory
- Create a new storage bucket that will contain the Terraform stack state

We'll use the contents of `sa_key.json` and add them to a `GCP_CREDENTIALS` secret in this same Github repository.

![GCP credentials secret in Github](docs/images/gcp-credentials-secret.png)

It is important to note that the permissions we granted the `infra-bootstrap` service account will only be valid for 12 hours after they have been granted. The purpose of this account should be quite short-lived, so it's better to revoke permissions if they are not used.

In case you need to renew the policy binding for a further 12 hours, you can run:

```
sh ./scripts/renew-sa-role-binding.sh project-id
```

Replacing `project-id` with your own value.

**Warning:** careful not to leak the private key anywhere. Once you add it to the repo secrets, best to remove it from your local machine

### Preparing Github environment

If the previous script was successful, it should print a message similar to this one:

![Script completed successfully](docs/images/script-success.png)

We'll need the project ID and bucket name for the next steps.

Let's go to our repo in Github: first thing, we add the credentials as described above. Next we go into the **Actions** tab: on the left-hand side we should see an action named **Deploy stack**. We click on it, and click on **Run workflow**.

![Github workflow inputs](docs/images/gh-action-input.png)

A list of inputs appear. We need to provide:

- Project ID (printed by script)
- Region
- Bucket name (printed by script)
- List of all the repos that can impersonate the deployer service account, in the format `org/repo-one,org/repo-two`

Once we fill all of this, we click the green button and a new workflow is started for us. If it all goes well, the workflow completes without issues, and our bootstrapping is finally complete!