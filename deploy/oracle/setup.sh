#!/usr/bin/env bash
# One-time setup of Nourish on a fresh Ubuntu server (Oracle Cloud, Hetzner, …).
# Run from the cloned repo as the default user:  bash deploy/oracle/setup.sh your-name.duckdns.org
# Safe to re-run: an existing .env, database and backups are left alone.
set -euo pipefail

DOMAIN="${1:?Usage: bash deploy/oracle/setup.sh <domain, e.g. nourish-you.duckdns.org>}"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DATA_DIR="$HOME/nourish-data"
RUN_USER="$(id -un)"

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

step "System packages"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git curl build-essential python3 sqlite3 caddy iptables-persistent

step "Timezone (\"today\" is worked out on the server)"
sudo timedatectl set-timezone Asia/Kolkata

step "Node.js 22"
if ! node -v 2>/dev/null | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

step "Swap, so the build fits on small servers"
if [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 3000 ] && ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

step "Open ports 80 and 443 in the server firewall"
# Oracle's Ubuntu images reject everything but SSH; insert the rules before that REJECT.
for port in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null; then
    line="$(sudo iptables -L INPUT --line-numbers | awk '/REJECT/{print $1; exit}')"
    sudo iptables -I INPUT "${line:-1}" -p tcp --dport "$port" -m state --state NEW -j ACCEPT
  fi
done
sudo netfilter-persistent save

step "Configuration"
mkdir -p "$DATA_DIR/backups"
if [ ! -f "$APP_DIR/.env" ]; then
  cat > "$APP_DIR/.env" <<EOF
DATABASE_URL="file:$DATA_DIR/nourish.db"
AUTH_SECRET="$(openssl rand -base64 48)"
TZ=Asia/Kolkata
# Optional: a server-wide AI key for users who have not added their own.
# GROQ_API_KEY=
EOF
  chmod 600 "$APP_DIR/.env"
  echo "Created $APP_DIR/.env"
else
  echo "Keeping the existing $APP_DIR/.env"
fi

step "Install, migrate, seed and build"
cd "$APP_DIR"
npm ci
npx prisma migrate deploy
npm run db:seed
npm run build

step "Run it as a service"
sudo tee /etc/systemd/system/nourish.service >/dev/null <<EOF
[Unit]
Description=Nourish
After=network.target

[Service]
User=$RUN_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start -- -H 127.0.0.1 -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now nourish
sudo systemctl restart nourish

step "HTTPS with Caddy"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
EOF
sudo systemctl reload caddy || sudo systemctl restart caddy

step "Nightly database backup (kept 14 days)"
sudo tee /etc/cron.d/nourish-backup >/dev/null <<EOF
30 3 * * * $RUN_USER sqlite3 $DATA_DIR/nourish.db ".backup '$DATA_DIR/backups/nourish-\$(date +\%F).db'" && find $DATA_DIR/backups -name '*.db' -mtime +14 -delete
EOF

step "Done"
echo "Open https://$DOMAIN — the first visit can take a minute while the HTTPS certificate is issued."
echo "Logs:   journalctl -u nourish -f      Caddy: journalctl -u caddy -f"
