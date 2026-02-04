---
description: How to connect a new Google Vertex AI account for image generation
---

# Connect New Vertex AI Account

Quick steps to switch to a new Google Cloud account for Vertex AI image generation.

## 1. Create/Select GCP Project

- Go to [console.cloud.google.com](https://console.cloud.google.com)
- Create new project or select existing one
- Note the **Project ID** (e.g., `my-project-123`)

## 2. Enable Vertex AI API

- Go to: `https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=YOUR_PROJECT_ID`
- Click **Enable**

## 3. Create Service Account & Key

1. Go to **IAM & Admin → Service Accounts**
2. Click **Create Service Account**
   - Name: `vertex-ai-access`
   - Role: **Vertex AI User**
3. Click on the service account → **Keys** tab
4. **Add Key → Create new key → JSON**
5. Download the JSON file

### If Key Creation is Blocked (Org Policy)

Run in [Cloud Shell](https://console.cloud.google.com/?cloudshell=true):
```bash
# Grant yourself org policy admin (if needed)
gcloud organizations add-iam-policy-binding YOUR_ORG_ID \
  --member="user:your-email@gmail.com" \
  --role="roles/orgpolicy.policyAdmin"

# Delete the restriction
gcloud org-policies delete iam.disableServiceAccountKeyCreation --organization=YOUR_ORG_ID
```

## 4. Update Environment Variables

### Local (.env.local)
```bash
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS_JSON='{ paste entire JSON here }'
```

### Vercel
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Update `GOOGLE_CLOUD_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS_JSON`
3. Redeploy

## 5. Test

Generate an image - should work within 2-3 minutes of enabling the API!

---

## For Video Generation (Optional)

Also create a GCS bucket:
1. Go to [Cloud Storage](https://console.cloud.google.com/storage)
2. Create bucket: `{project-id}-veo-output`
3. Add env var: `GCS_VIDEO_BUCKET=your-bucket-name`
