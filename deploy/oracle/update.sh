#!/usr/bin/env bash
# Deploy the latest code from GitHub:  bash deploy/oracle/update.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

git pull --ff-only
npm ci
npx prisma migrate deploy
npm run db:seed
npm run build
sudo systemctl restart nourish
echo "Updated to $(git log -1 --format='%h %s')"
