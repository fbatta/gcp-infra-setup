# GCP infrastructure setup

## Bootstrapping

### Prerequisites

- `gcloud` CLI
- `jq`
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
sh ./scripts/create-bootstrap-sa.sh your-project-id-here
```

### Result

The previous script will do a bunch of things:

- Enable the IAM API
- Create a new service account called `infra-bootstrap`
- Create a new role called `infra.bootstrap`
- Assign the `infra.bootstrap` role to the `infra-bootstrap` service account
- Create a new private key for the SA, and download it into a `sa_key.json` file inside this directory

We'll use the contents of `sa_key.json` and add them to a `GCP_CREDENTIALS` 

**Warning:** careful not to leak the private key anywhere. Once you add it to the repo secrets, remove it from your local machine