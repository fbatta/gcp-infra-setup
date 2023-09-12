# Make sure project id is passed as an argument
if [ -z "$1" ]; then
    echo "No project ID provided"
    exit 1
fi

PROJECT_ID=$1
ROLE_NAME=infra.bootstrap
PRIVATE_KEY_FILENAME=sa_key.json
SA_ID=infra-bootstrap

# Make sure gcloud CLI is present
if ! type gcloud >/dev/null 2>&1; then
    echo "No gcloud CLI found on your system. Please install gcloud before running this script."
    exit 1
fi

# Make sure a user is logged into the gcloud CLI
AVAILABLE_ACCOUNTS=$(
    gcloud auth list --format="json" | jq length
)
if [ "$AVAILABLE_ACCOUNTS" -eq "0" ]; then
    echo "No accounts signed in with gcloud. Please sign in with gcloud auth login."
    exit 1
fi

# Check if the project ID is available
PROJECT_INDEX=$(
    gcloud projects list --format="json" | jq '.[] | [ .projectId ]' | jq -s 'add | index( "${PROJECT_ID}" )'
)
if [ -z "$PROJECT_INDEX" ]; then
    echo "No project with ID $1 was found. Please check the project ID again."
    exit 1
fi

# Enable IAM APIs
gcloud services enable iam.googleapis.com \
    --project="${PROJECT_ID}"

# Create new SA used for bootstrapping
gcloud iam service-accounts create ${SA_ID} \
    --description="SA used for bootstrapping GCP infrastructure for a new project" \
    --project="${PROJECT_ID}"

SA_EMAIL=${SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com

# Create a role with the necessary permissions for bootstrapping
gcloud iam roles create ${ROLE_NAME} \
    --project="${PROJECT_ID}" \
    --file="./bootstrap-sa-role.yaml"

# Get the ID of the role we just created
ROLE_ID=$(
    gcloud iam roles describe ${ROLE_NAME} \
        --project="${PROJECT_ID}" \
        --format="value(name)"
)

# Bind the role to the SA
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE_ID}"

# Create and download a SA key
gcloud iam service-accounts keys create ./${PRIVATE_KEY_FILENAME} \
    --iam-account="${SA_EMAIL}"
