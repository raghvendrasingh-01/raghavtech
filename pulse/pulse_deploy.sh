#!/bin/bash
set -e

# Pulse Full Production Deployment Script
echo "================================================="
echo "  Pulse Production Deployment Script             "
echo "  Target Domain: raghavtech.me                   "
echo "================================================="
echo ""

# 1. Ask for credentials securely
echo "--- Phase 1 & 2: Backend Configuration (Google Cloud Run) ---"
echo "Please enter your Supabase Project URL (e.g., https://xxxxx.supabase.co):"
read SUPABASE_URL
echo "Please enter your Supabase Service Role Key:"
read -s SUPABASE_SERVICE_ROLE_KEY
echo ""
echo "Please enter your OpenRouter API Key:"
read -s OPENROUTER_API_KEY
echo ""
echo "Please enter your Clerk Production Publishable Key (pk_live_...):"
read CLERK_PUB_KEY
echo "Please enter your Clerk Production Secret Key (sk_live_...):"
read -s CLERK_SECRET_KEY
echo ""

CORS="https://raghavtech.me,https://www.raghavtech.me,https://pulse.vercel.app,http://localhost:3000"

echo ""
echo "Deploying Backend to Google Cloud Run..."
cd api
gcloud run deploy pulse-api \
  --source . \
  --allow-unauthenticated \
  --set-env-vars="SUPABASE_URL=$SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY,OPENROUTER_API_KEY=$OPENROUTER_API_KEY,CORS_ORIGINS=$CORS"

cd ..
echo ""
echo "--- Phase 3: Frontend Deployment (Vercel) ---"
echo "Please paste the Cloud Run Service URL you just got from the backend deployment:"
echo "(e.g., https://pulse-api-xxxxx-uc.a.run.app)"
read API_URL

echo ""
echo "Deploying Frontend to Vercel..."
cd web

# Set up project without linking to the wrong parent folder
vercel link --yes --project-name pulse-web
vercel env add NEXT_PUBLIC_API_URL production < <(echo "$API_URL")
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production < <(echo "$CLERK_PUB_KEY")
vercel env add CLERK_SECRET_KEY production < <(echo "$CLERK_SECRET_KEY")
vercel env add NEXT_PUBLIC_CLERK_SIGN_IN_URL production < <(echo "/login")
vercel env add NEXT_PUBLIC_CLERK_SIGN_UP_URL production < <(echo "/login")
vercel env add NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL production < <(echo "/dashboard")
vercel env add NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL production < <(echo "/dashboard")

vercel deploy --prod

echo ""
echo "Adding custom domain to Vercel..."
vercel domains add raghavtech.me

echo "================================================="
echo "Deployment initiated successfully!"
echo "Please ensure you have added the Vercel DNS records to your domain registrar for raghavtech.me."
echo "And remember to add the Clerk DNS records as well!"
echo "================================================="
