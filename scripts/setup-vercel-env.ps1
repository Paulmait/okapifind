# OkapiFind - Vercel Environment Variables Setup Script (PowerShell)
# This script helps you quickly set up all required environment variables in Vercel
# Usage: .\scripts\setup-vercel-env.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 OkapiFind - Vercel Environment Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
if (!(Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Vercel CLI is not installed." -ForegroundColor Red
    Write-Host "📦 Install it with: npm i -g vercel" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Vercel CLI detected" -ForegroundColor Green
Write-Host ""

# Check if .env.local exists
if (!(Test-Path "OkapiFind\.env.local")) {
    Write-Host "❌ .env.local file not found in OkapiFind directory" -ForegroundColor Red
    Write-Host "💡 Copy .env.example to .env.local and fill in your values" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found .env.local file" -ForegroundColor Green
Write-Host ""

# Prompt for environment
Write-Host "📝 Which environment do you want to configure?" -ForegroundColor Yellow
Write-Host "1) Production only"
Write-Host "2) Preview only"
Write-Host "3) Development only"
Write-Host "4) All environments"
$envChoice = Read-Host "Enter choice (1-4)"

$envFlag = switch ($envChoice) {
    "1" { "production" }
    "2" { "preview" }
    "3" { "development" }
    "4" { "production,preview,development" }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "🔧 Setting up environment variables for: $envFlag" -ForegroundColor Cyan
Write-Host ""

# Read .env.local file
$envContent = Get-Content "OkapiFind\.env.local" -Raw

# Critical variables that must be set
$criticalVars = @(
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "EXPO_PUBLIC_FIREBASE_APP_ID",
    "EXPO_PUBLIC_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",
    "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN"
)

# Optional but recommended variables
$optionalVars = @(
    "EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID",
    "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
    "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "EXPO_PUBLIC_GEMINI_API_KEY",
    "EXPO_PUBLIC_SENTRY_DSN",
    "EXPO_PUBLIC_REVENUECAT_API_KEY_IOS",
    "EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID",
    "STRIPE_SECRET_KEY",
    "RESEND_API_KEY"
)

Write-Host "📋 Setting critical environment variables..." -ForegroundColor Cyan
Write-Host ""

$missingVars = @()

foreach ($var in $criticalVars) {
    # Extract value from .env.local
    $pattern = "(?m)^$var=(.+)$"
    if ($envContent -match $pattern) {
        $value = $matches[1].Trim().Trim('"')

        # Check if value is placeholder
        if ([string]::IsNullOrEmpty($value) -or $value -like "your-*" -or $value -like "pk_*" -or $value -like "AIza*") {
            Write-Host "⚠️  $var is not set or has placeholder value" -ForegroundColor Yellow
            $missingVars += $var
        } else {
            Write-Host "✅ Setting $var" -ForegroundColor Green
            Push-Location "OkapiFind"
            echo $value | vercel env add $var $envFlag 2>&1 | Out-Null
            Pop-Location
        }
    } else {
        Write-Host "⚠️  $var not found in .env.local" -ForegroundColor Yellow
        $missingVars += $var
    }
}

Write-Host ""
Write-Host "📋 Setting optional environment variables..." -ForegroundColor Cyan
Write-Host ""

foreach ($var in $optionalVars) {
    # Extract value from .env.local
    $pattern = "(?m)^$var=(.+)$"
    if ($envContent -match $pattern) {
        $value = $matches[1].Trim().Trim('"')

        # Check if value is set
        if (![string]::IsNullOrEmpty($value) -and $value -notlike "your-*" -and $value -notlike "pk_*" -and $value -notlike "sk_*") {
            Write-Host "✅ Setting $var" -ForegroundColor Green
            Push-Location "OkapiFind"
            echo $value | vercel env add $var $envFlag 2>&1 | Out-Null
            Pop-Location
        } else {
            Write-Host "⏭️  Skipping $var (not configured)" -ForegroundColor Gray
        }
    } else {
        Write-Host "⏭️  Skipping $var (not found)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($missingVars.Count -eq 0) {
    Write-Host "✅ All critical environment variables are set!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 You can now deploy to Vercel:" -ForegroundColor Cyan
    Write-Host "   cd OkapiFind" -ForegroundColor White
    Write-Host "   vercel --prod" -ForegroundColor White
    Write-Host ""
    Write-Host "📖 View your environment variables:" -ForegroundColor Cyan
    Write-Host "   vercel env ls" -ForegroundColor White
} else {
    Write-Host "⚠️  Warning: Some critical variables are missing:" -ForegroundColor Yellow
    foreach ($var in $missingVars) {
        Write-Host "   - $var" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "📝 Please update your OkapiFind\.env.local file and run this script again" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Useful Vercel commands:" -ForegroundColor Cyan
Write-Host "   vercel env ls              - List all environment variables" -ForegroundColor White
Write-Host "   vercel env rm VAR_NAME env - Remove a variable" -ForegroundColor White
Write-Host "   vercel --prod              - Deploy to production" -ForegroundColor White
Write-Host "   vercel                     - Deploy preview" -ForegroundColor White
Write-Host ""
