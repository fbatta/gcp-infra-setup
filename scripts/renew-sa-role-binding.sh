# Make sure project id is passed as an argument
if [ -z "$1" ]; then
    echo "No project ID provided."
    exit 1
fi

PROJECT_ID=$1
REGION=$2
ROLE_NAME=infra.bootstrap
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

SA_EMAIL=${SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com

# Get the ID of the role we just created
ROLE_ID=$(
    gcloud iam roles describe ${ROLE_NAME} \
        --project="${PROJECT_ID}" \
        --format="value(name)"
)

if [[ "$OSTYPE" == "darwin"* ]]; then
    TIME_PLUS_12_HOURS=$(
        date -v+12H -u +"%Y-%m-%dT%H:%M:%SZ"
    )
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    TIME_PLUS_12_HOURS=$(
        date -d "+12 hours" -u +"%Y-%m-%dT%H:%M:%SZ"
    )
fi

# Bind the role to the SA
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE_ID}" \
    --condition='expression=request.time < timestamp("${TIME_PLUS_12_HOURS}"),title=expires_12_hours,description=Expires after 12 hours from when the binding is established'
