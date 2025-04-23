#!/bin/bash
set -e

# Usage: ./release.sh 1.2.3
VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

echo "🔧 Setting version to $VERSION..."
npm version "$VERSION" --no-git-tag-version

echo "🛠 Running build..."
npm run build

echo "📦 Committing changes..."
git add .
git commit -m "Release v$VERSION"
git tag "v$VERSION"

echo "🚀 Pushing to origin..."
git push origin main --tags

echo "📤 Publishing to npm..."
npm publish

echo "✅ Release v$VERSION complete!"