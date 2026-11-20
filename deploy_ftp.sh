#!/usr/bin/env bash
# Deploy of a new version on the server. Run it in the Laravel directory (/www/wwwroot/rackatlas.dev)
# as the user that owns the checkout (or root). Stops at the first error, and the site is
# switched back on even then.
set -euo pipefail

# The panel starts the deploy without $HOME; composer, npm and git need one.
export HOME="${HOME:-/root}"
export COMPOSER_HOME="${COMPOSER_HOME:-$HOME/.composer}"

APP_DIR="${APP_DIR:-/www/wwwroot/rackatlas.dev}"
SERVICES="rackatlas-scheduler rackatlas-queue rackatlas-ssr rackatlas-terminal"

cd "$APP_DIR"

# Visitors see the maintenance page while code, vendor and the database are out of step.
php artisan down --retry=30 || true
trap 'php artisan up || true' EXIT

# The checkout belongs to www but the deploy runs as root: git refuses that ("dubious ownership")
# unless the directory is marked safe. -c needs no $HOME and no global config.
git -c safe.directory="$APP_DIR" pull origin main

composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# Clear the old caches before the migrations, so they run against the new code and config.
php artisan optimize:clear
php artisan migrate --force
php artisan storage:link --force

# Frontend: client bundle + SSR bundle (bootstrap/ssr). Wayfinder routes are committed, the build
# only regenerates them when PHP is found.
npm ci
npm run build:ssr

# Cache config, routes, views and events for production.
php artisan optimize

# Files created above by root must belong to the web user, otherwise PHP-FPM cannot write
# to storage and bootstrap/cache.
find "$APP_DIR" -path "$APP_DIR/public/.user.ini" -prune -o -exec chown www:www {} +

# New code for the long-running processes: the queue worker and the scheduler keep the old code in
# memory, the SSR server serves the old bundle and the terminal bridge reads .env only on start.
php artisan queue:restart
systemctl restart $SERVICES

php artisan up
trap - EXIT

# Quick check that the processes came up and SSR answers.
systemctl is-active $SERVICES
php artisan inertia:check-ssr || echo "WARNING: the SSR server does not answer yet, check: journalctl -u rackatlas-ssr"
