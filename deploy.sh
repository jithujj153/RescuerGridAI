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

# ─── Enable required APIs ────────────────────────
echo "→ Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project="${PROJECT_ID}" --quiet

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

# ─── Build with Cloud Build (passes NEXT_PUBLIC_* as build args) ──
echo "→ Building container image via Cloud Build..."
gcloud builds submit \
  --project="${PROJECT_ID}" \
  --config=cloudbuild.yaml \
  --substitutions="_NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-},_NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-}" \
  --timeout=900s

# ─── Done ────────────────────────────────────────
URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format="value(status.url)")

echo ""
echo "═══════════════════════════════════════════"
echo "  Deployed successfully!"
echo "  ${URL}"
echo "═══════════════════════════════════════════"
