usage()
{
    echo "Usage: $0 PROJECT_ID REGION"
    exit 1
}
stderr_and_exit()
{
    >&2 echo "$1"
    exit 1
}

bold=$(tput bold)
normal=$(tput sgr0)

describe_sa()
{
    gcloud iam service-accounts describe $1 \
    --project="${PROJECT_ID}" \
    --format="value(name)"
}
describe_role()
{
    gcloud iam roles describe $1 \
    --project="${PROJECT_ID}" \
    --format="value(name)"
}
describe_bucket()
{
    gcloud storage buckets describe $1 \
    --format="value(name)"
}

# Make sure project id is passed as an argument
if [ -z "$1" ]; then
    echo "❌ No project ID provided."
    usage
fi

# Make sure the region is provided
if [ -z "$2" ]; then
    echo "❌ No region provided."
    usage
fi

PROJECT_ID=$1
REGION=$2
ROLE_NAME=infra.bootstrap
PRIVATE_KEY_FILENAME=sa_key.json
SA_ID=infra-bootstrap
SA_EMAIL=${SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com

# Make sure gcloud CLI is present
echo "⏳ Checking for gcloud CLI..."
if ! type gcloud >/dev/null 2>&1; then
    stderr_and_exit "❌ No gcloud CLI found on your system. Please install gcloud before running this script."
else
    echo "✅ gcloud CLI detected on your system\n"
fi

# Make sure a user is logged into the gcloud CLI
echo "⏳ Checking for logged in accounts..."
AVAILABLE_ACCOUNTS=$(
    gcloud auth list --format="json" | jq length
)
if [ "$AVAILABLE_ACCOUNTS" -eq "0" ]; then
    stderr_and_exit "❌ No accounts signed in with gcloud. Please sign in with gcloud auth login."
else
    echo "✅ Found at least one logged in account\n"
fi

# Check if the project ID is available
echo "Checking if ${PROJECT_ID} exists..."
PROJECT_INDEX=$(
    gcloud projects list --format="json" | jq '.[] | [ .projectId ]' | jq -s 'add | index( "${PROJECT_ID}" )'
)
if [ -z "$PROJECT_INDEX" ]; then
    stderr_and_exit "❌ No project with ID $1 was found. Please check the project ID again."
else
    echo "✅ Project ${PROJECT_ID} found\n"
fi

# Enable essential APIs
echo "Enabling GCP APIs..."
for API in iam cloudresourcemanager run apigateway artifactregistry containerregistry sql-component sqladmin
do
    {
        gcloud services enable ${API}.googleapis.com \
        --project="${PROJECT_ID}"
    } > /dev/null && echo "✅ ${API} API enabled" || {
        >&2 echo "❌ Could not enable ${API} API. Exiting..."
        exit 1
    }
done
echo "\n"

# Create new SA used for bootstrapping
## Check if SA already exists
echo "⏳ Checking if $SA_EMAIL already exists..."
SA_NAME=$(describe_sa $SA_EMAIL) &> /dev/null

if [ -z "$SA_NAME" ]; then
    echo "⏳ Creating service account ${SA_EMAIL}..."
    {
        gcloud iam service-accounts create ${SA_ID} \
        --description="SA used for bootstrapping GCP infrastructure for a new project" \
        --project="${PROJECT_ID}"
    } > /dev/null && echo "✅ Created service account ${SA_EMAIL}\n" || stderr_and_exit "❌ Could not create service account ${SA_EMAIL}. Exiting..."
else
    echo "👀 Service account ${SA_EMAIL} already present"
fi

# Create (or update) a role with the necessary permissions for bootstrapping
echo "🕵️ Checking if role ${ROLE_NAME} already exists...\n"
ROLE_ID=$(describe_role $ROLE_NAME) &> /dev/null

if [ -z "$ROLE_ID" ]; then
    echo "⏳ Role ${ROLE_NAME} not found. Creating it..."
    {
        gcloud iam roles create ${ROLE_NAME} \
        --project="${PROJECT_ID}" \
        --file="./bootstrap-sa-role.yaml"
    } > /dev/null && echo "✅ Created new custom role ${ROLE_NAME}\n" || stderr_and_exit "❌ Could not create custom role ${ROLE_NAME}. Exiting..."
else
    echo "⬆️ Role ${ROLE_NAME} already present. Updating it..."
    {
        gcloud iam roles update ${ROLE_NAME} \
        --project="${PROJECT_ID}" \
        --file="./bootstrap-sa-role.yaml"
    } > /dev/null && echo "✅ Updated custom role ${ROLE_NAME}\n" || stderr_and_exit "❌ Could not update custom role ${ROLE_NAME}. Exiting..."
fi

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
echo "⏳ Binding role ${ROLE_NAME} to service account ${SA_EMAIL}..."
{
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE_ID}" \
    --condition='expression=request.time < timestamp("'$TIME_PLUS_12_HOURS'"),title=expires_12_hours,description=Expires after 12 hours from when the binding is established'
} > /dev/null && echo "✅ Role ${ROLE_NAME} successfully bound to ${SA_EMAIL}\n" || >&2 stderr_and_exit "❌ Could not bind role ${ROLE_NAME} to ${SA_EMAIL}. Exiting...\n"

# Create and download a SA key
echo "⏳ Generating service account private key..."
{
    gcloud iam service-accounts keys create ./${PRIVATE_KEY_FILENAME} \
    --iam-account="${SA_EMAIL}"
} > /dev/null && echo "✅ Private key generated\n" || >&2 echo "❌ Could generate private key\n"

BUCKET_URL=gs://$1-infra-bootstrap-stack

# Create stack bucket
## Check if it exists
echo "🕵️ Checking if bucket ${BUCKET_URL} already exists..."
BUCKET_NAME=$(describe_bucket $BUCKET_URL) &> /dev/null
if [ -z "$BUCKET_NAME" ]; then
    echo "⏳ Creating storage bucket ${BUCKET_URL}..."
    {
        gcloud storage buckets create ${BUCKET_URL} \
        --project=$1 \
        --location=${REGION} \
        --uniform-bucket-level-access
    } > /dev/null && echo "✅ Bucket ${BUCKET_URL} created\n" || >&2 echo "❌ Could not create ${BUCKET_URL}\n"
else
    echo "👀 Bucket ${BUCKET_URL} already present\n"
fi

# Give the SA access to the bucket
echo "⏳ Granting ${SA_EMAIL} access to ${BUCKET_URL}..."
{
    gsutil iam ch \
    serviceAccount:${SA_ID}@$1.iam.gserviceaccount.com:objectAdmin \
    ${BUCKET_URL}
} > /dev/null && echo "✅ Access granted\n" || >&2 echo "❌ Could not grant access\n"

echo "🥳 ${bold}Success!${normal} The process has completed. Here's a few things you'll need:\n"
echo "🗺️ ${bold}Project ID:${normal} $PROJECT_ID"
echo "🪣 ${bold}Bucket name:${normal} $BUCKET_NAME"
