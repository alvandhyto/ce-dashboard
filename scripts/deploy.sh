#!/usr/bin/env bash
#
# Deploys the latest main on the server: pull, install, build, reload pm2.
#
#     scripts/deploy.sh
#
# Run it on the server after merging into main. It stops at the first failure, and the running
# site is only touched at the very end, so a broken install or build leaves the current version up.
#
# Everything is inside main(), which runs only once bash has read the whole file. The script
# pulls a new copy of itself; without this, bash would carry on reading the new file mid-run.

set -euo pipefail

APP_NAME="ce-dashboard"
BRANCH="main"

main() {
    cd "$(dirname "$0")/.."

    local current
    current="$(git branch --show-current)"
    if [[ "$current" != "$BRANCH" ]]; then
        echo "This copy is on '$current', not '$BRANCH'. Check out $BRANCH first." >&2
        exit 1
    fi

    # --ff-only refuses rather than merging, and git refuses to overwrite files edited on the
    # server. Either way the deploy stops and nothing changes.
    git pull --ff-only origin "$BRANCH"
    echo "Deploying $(git log -1 --format='%h %s')"

    # Exactly what package-lock.json says, dev tools included: the build needs them.
    npm ci --no-audit --no-fund

    # Vite empties its output folder before building, so building straight into dist/ would
    # leave the site without files if the build failed. Build next to it, then swap.
    rm -rf dist-next
    npm run build -- --outDir dist-next
    rm -rf dist-old
    if [[ -d dist ]]; then mv dist dist-old; fi
    mv dist-next dist
    rm -rf dist-old

    # reload restarts without dropping requests; start covers the very first deploy.
    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
        pm2 reload "$APP_NAME" --update-env
    else
        pm2 start npm --name "$APP_NAME" -- start
    fi
    pm2 save

    echo "Deployed."
}

main "$@"
