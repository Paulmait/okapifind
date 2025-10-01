#!/bin/bash

# OkapiFind - Vercel Environment Variables Setup Script
# This script helps you quickly set up all required environment variables in Vercel
# Usage: ./scripts/setup-vercel-env.sh

set -e

echo "🚀 OkapiFind - Vercel Environment Setup"
echo "========================================"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed."
    echo "📦 Install it with: npm i -g vercel"
    exit 1
fi

echo "✅ Vercel CLI detected"
echo ""

# Check if .env.local exists
if [ ! -f "OkapiFind/.env.local" ]; then
    echo "❌ .env.local file not found in OkapiFind directory"
    echo "💡 Copy .env.example to .env.local and fill in your values"
    exit 1
fi

echo "✅ Found .env.local file"
echo ""

# Prompt for environment (production, preview, development)
echo "📝 Which environment do you want to configure?"
echo "1) Production only"
echo "2) Preview only"
echo "3) Development only"
echo "4) All environments"
read -p "Enter choice (1-4): " env_choice

case $env_choice in
    1) ENV_FLAG="production" ;;
    2) ENV_FLAG="preview" ;;
    3) ENV_FLAG="development" ;;
    4) ENV_FLAG="production,preview,development" ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

echo ""
echo "🔧 Setting up environment variables for: $ENV_FLAG"
echo ""

# Read .env.local and set variables in Vercel
cd OkapiFind

# Critical variables that must be set
CRITICAL_VARS=(
    "EXPO_PUBLIC_FIREBASE_API_KEY"
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID"
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    "EXPO_PUBLIC_FIREBASE_APP_ID"
    "EXPO_PUBLIC_SUPABASE_URL"
    "EXPO_PUBLIC_SUPABASE_ANON_KEY"
    "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
    "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN"
)

# Optional but recommended variables
OPTIONAL_VARS=(
    "EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID"
    "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"
    "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"
    "EXPO_PUBLIC_GEMINI_API_KEY"
    "EXPO_PUBLIC_SENTRY_DSN"
    "EXPO_PUBLIC_REVENUECAT_API_KEY_IOS"
    "EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID"
    "STRIPE_SECRET_KEY"
    "RESEND_API_KEY"
)

echo "📋 Setting critical environment variables..."
echo ""

missing_vars=()

for var in "${CRITICAL_VARS[@]}"; do
    # Get value from .env.local
    value=$(grep "^${var}=" .env.local | cut -d '=' -f2- | sed 's/^"//' | sed 's/"$//')

    if [ -z "$value" ] || [ "$value" = "your-" ] || [ "$value" = "pk_" ] || [ "$value" = "AIza" ]; then
        echo "⚠️  $var is not set or has placeholder value"
        missing_vars+=("$var")
    else
        echo "✅ Setting $var"
        vercel env add "$var" "$ENV_FLAG" <<< "$value" > /dev/null 2>&1 || true
    fi
done

echo ""
echo "📋 Setting optional environment variables..."
echo ""

for var in "${OPTIONAL_VARS[@]}"; do
    # Get value from .env.local
    value=$(grep "^${var}=" .env.local | cut -d '=' -f2- | sed 's/^"//' | sed 's/"$//')

    if [ -n "$value" ] && [ "$value" != "your-" ] && [ "$value" != "pk_" ] && [ "$value" != "sk_" ]; then
        echo "✅ Setting $var"
        vercel env add "$var" "$ENV_FLAG" <<< "$value" > /dev/null 2>&1 || true
    else
        echo "⏭️  Skipping $var (not configured)"
    fi
done

cd ..

echo ""
echo "========================================"

if [ ${#missing_vars[@]} -eq 0 ]; then
    echo "✅ All critical environment variables are set!"
    echo ""
    echo "🚀 You can now deploy to Vercel:"
    echo "   vercel --prod"
    echo ""
    echo "📖 View your environment variables:"
    echo "   vercel env ls"
else
    echo "⚠️  Warning: Some critical variables are missing:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "📝 Please update your .env.local file and run this script again"
fi

echo ""
echo "💡 Useful Vercel commands:"
echo "   vercel env ls              - List all environment variables"
echo "   vercel env rm VAR_NAME env - Remove a variable"
echo "   vercel --prod              - Deploy to production"
echo "   vercel                     - Deploy preview"
echo ""
