#!/bin/bash
set -euo pipefail

# ─── Configuration ──────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID env var}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="rescuegrid-ai"
REPO_NAME="rescuegrid"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}"

echo "═══════════════════════════════════════════"
echo "  RescueGrid AI — Cloud Run Deployment"
echo "═══════════════════════════════════════════"
echo "  Project:  ${PROJECT_ID}"
echo "  Region:   ${REGION}"
echo "  Image:    ${IMAGE}"
echo "═══════════════════════════════════════════"

# ─── Ensure Artifact Registry repo exists ───────
echo "→ Ensuring Artifact Registry repository..."
gcloud artifacts repositories describe "${REPO_NAME}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" 2>/dev/null || \
gcloud artifacts repositories create "${REPO_NAME}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --repository-format=docker \
  --description="RescueGrid AI container images"

# ─── Build with Cloud Build ─────────────────────
echo "→ Building container image via Cloud Build..."
gcloud builds submit \
  --project="${PROJECT_ID}" \
  --tag "${IMAGE}" \
  --timeout=600s

# ─── Deploy to Cloud Run ────────────────────────
echo "→ Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_MAPS_API_KEY=maps-api-key:latest,GOOGLE_CLOUD_PROJECT_ID=gcp-project-id:latest" \
  --cpu-boost \
  --min-instances=0 \
  --max-instances=10 \
  --memory=1Gi \
  --cpu=2 \
  --port=8080 \
  --timeout=300s

# ─── Done ────────────────────────────────────────
URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format="value(status.url)")

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Deployed successfully!"
echo "  🌐 ${URL}"
echo "═══════════════════════════════════════════"
