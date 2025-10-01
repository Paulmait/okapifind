#!/bin/bash
set -e

echo "🚀 Starting Vercel build for OkapiFind..."
echo ""

# 1. Clean everything
echo "🧹 Cleaning old build artifacts..."
rm -rf web-build
rm -rf node_modules/.cache
rm -rf .expo
echo "✅ Clean complete"
echo ""

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps
echo "✅ Dependencies installed"
echo ""

# 3. Apply patches
echo "🔧 Applying patches..."
npm run postinstall
echo "✅ Patches applied"
echo ""

# 4. Verify patch was applied
echo "🔍 Verifying patch application..."
if grep -q "import { SafeAreaListener }" node_modules/@react-navigation/elements/src/useFrameSize.tsx; then
    echo "✅ Patch verified: useFrameSize.tsx uses import (not require)"
else
    echo "❌ ERROR: Patch not applied! useFrameSize.tsx still uses require()"
    echo "Content of useFrameSize.tsx line 12-17:"
    sed -n '12,17p' node_modules/@react-navigation/elements/src/useFrameSize.tsx
    exit 1
fi
echo ""

# 5. Build web app
echo "🏗️  Building web app..."
npm run build:web
echo "✅ Build complete"
echo ""

# 6. Verify build output
echo "🔍 Verifying build output..."
if [ -f "web-build/index.html" ]; then
    echo "✅ index.html created"
else
    echo "❌ ERROR: index.html not found!"
    exit 1
fi

if [ -d "web-build/static/js" ]; then
    echo "✅ JavaScript bundles created"
    ls -lh web-build/static/js/*.js | head -5
else
    echo "❌ ERROR: JavaScript bundles not found!"
    exit 1
fi
echo ""

echo "🎉 Build successful!"
echo "📦 Output: web-build/"
