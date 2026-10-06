#!/usr/bin/env bash
set -e

# ==============================================================================
# Google Badge 3D Customizer - Deployment Helper
# ==============================================================================

PROJECT_NAME="google-badge-holder"
PORT="${PORT:-8080}"
REGION="${REGION:-europe-west1}"

echo "=================================================================="
echo "🚀 Google Badge 3D Customizer Deployment Helper"
echo "=================================================================="
echo "1. Run locally with Node.js (instant, no container needed)"
echo "2. Build & run locally with Docker"
echo "3. Deploy directly to Google Cloud Run (gcloud run deploy --source .)"
echo "4. Deploy public unauthenticated demo to Firebase Hosting (worldwide, no tunnels)"
echo "=================================================================="

usage() {
  echo "Usage: ./deploy.sh [local|docker|cloudrun|firebase]"
  exit 1
}

MODE="${1:-cloudrun}"

case "$MODE" in
  local)
    echo "▶ Starting local web server on port $PORT..."
    node server.js
    ;;

  docker)
    echo "▶ Checking Docker daemon..."
    if ! command -v docker &> /dev/null; then
      echo "❌ Docker CLI not found. Please install or start Docker Desktop, or use './deploy.sh local'."
      exit 1
    fi
    echo "▶ Building local Docker container ($PROJECT_NAME)..."
    docker build -t "$PROJECT_NAME" .
    echo "▶ Stopping any existing container..."
    docker rm -f "$PROJECT_NAME" 2>/dev/null || true
    echo "▶ Running container on http://localhost:$PORT..."
    docker run -d -p "$PORT:$PORT" --name "$PROJECT_NAME" "$PROJECT_NAME"
    echo "✅ Container running! Open http://localhost:$PORT in your browser."
    ;;

  cloudrun)
    echo "▶ Deploying to Google Cloud Run using source build..."
    if ! command -v gcloud &> /dev/null; then
      echo "❌ gcloud CLI not found. Please install the Google Cloud SDK."
      exit 1
    fi
    GCP_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "ge-app-project-alex")
    echo "▶ GCP Project: $GCP_PROJECT | Region: $REGION"
    CLOUDSDK_METRICS_ENVIRONMENT="${CLOUDSDK_METRICS_ENVIRONMENT:+$CLOUDSDK_METRICS_ENVIRONMENT }datacloud.antigravity" \
    gcloud run deploy "$PROJECT_NAME" \
      --source . \
      --region "$REGION" \
      --platform managed \
      --allow-unauthenticated \
      --port "$PORT" \
      --project "$GCP_PROJECT"
    ;;

  firebase)
    echo "▶ Deploying public unauthenticated demo to Firebase Hosting (worldwide, no tunnels)..."
    npx -y firebase-tools@latest deploy --only hosting --project techno-machine
    ;;

  *)
    usage
    ;;
esac
