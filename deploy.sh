#!/usr/bin/env bash
# Production deploy, run on the VPS as openclaw after `git pull` (see .github/workflows/deploy.yml).
# Safe to run by hand: cd /var/www/piggybang && git pull --ff-only && ./deploy.sh
# Only rebuilds what changed since the last successful deploy (.deployed-rev); `rm .deployed-rev` forces everything.
set -euo pipefail
cd "$(dirname "$0")"

last=$(cat .deployed-rev 2>/dev/null || true)
changed() { [ -z "$last" ] || ! git diff --quiet "$last" HEAD -- "$@" 2>/dev/null; }

if changed piggybang-api; then
  echo "== API"
  cd piggybang-api
  composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader
  php artisan migrate --force
  php artisan optimize:clear
  php artisan optimize
  php artisan queue:restart # the worker exits after its current job; piggybang-queue.service (Restart=always) starts it on the new code
  cd ..
fi

if changed piggybang-web; then
  echo "== Web"
  # Build in a copy: `next build` wipes .next, so building in place would take the live site down for the whole build.
  rsync -a --delete --exclude node_modules --exclude .next piggybang-web/ .web-build/
  cd .web-build
  cmp -s package-lock.json node_modules/.deployed-lock 2>/dev/null || { npm ci --no-audit --no-fund && cp package-lock.json node_modules/.deployed-lock; }
  npm run build
  # output: "standalone" leaves these two out of .next/standalone
  cp -r public .next/standalone/
  cp -r .next/static .next/standalone/.next/
  cd ..
  rsync -a --delete .web-build/.next/ piggybang-web/.next/
  sudo -n systemctl restart piggybang-web
fi

git rev-parse HEAD > .deployed-rev
echo "== Deployed $(git log -1 --format='%h %s')"
