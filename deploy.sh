#!/usr/bin/env bash
# Production deploy, run on the VPS as openclaw after `git pull` (see .github/workflows/deploy.yml).
# Safe to run by hand: cd /var/www/piggybang && git pull --ff-only && ./deploy.sh
# Only rebuilds what changed since the last successful deploy (.deployed-rev); `rm .deployed-rev` forces everything.
set -euo pipefail
cd "$(dirname "$0")"

# Preflight: everything this script rewrites must belong to the deploying user, and the web server must run as it
# (the server writes caches into its build). Otherwise the deploy would stop halfway: new API, stale web.
me=$(id -un)
web_user=$(systemctl show -p User --value piggybang-web)
if [ "$web_user" != "$me" ]; then
  echo "piggybang-web runs as '${web_user:-root}', deploy runs as '$me'. Fix once: set User=$me in /etc/systemd/system/piggybang-web.service," >&2
  echo "then: sudo systemctl daemon-reload && sudo chown -R $me:$me $PWD/piggybang-web/.next && sudo systemctl restart piggybang-web" >&2
  exit 1
fi
foreign=$(find piggybang-web/.next .web-build piggybang-api/bootstrap/cache ! -user "$me" -print -quit 2>/dev/null || true)
if [ -n "$foreign" ]; then
  echo "Not owned by $me: $foreign (built or run as root?)" >&2
  echo "Fix once: sudo chown -R $me:$me $PWD/piggybang-web/.next $PWD/.web-build $PWD/piggybang-api/bootstrap/cache" >&2
  exit 1
fi

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
