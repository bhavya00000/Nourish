#!/usr/bin/env bash
# Deploy the latest code from GitHub:  bash deploy/oracle/update.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
# On a 1 GB server Node's default heap is too small for the build; let it use swap.
if [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 3000 ]; then export NODE_OPTIONS="--max-old-space-size=2560"; fi

git pull --ff-only
npm ci
npx prisma migrate deploy
npm run db:seed
npm run build
sudo systemctl restart nourish
echo "Updated to $(git log -1 --format='%h %s')"
