#!/bin/bash
# Run from this directory on gnuboard.net as kagla. No live service restart.
set -euo pipefail
cd "$(dirname "$0")"
destination=/home/kagla/nexibase-home-deploy
mkdir -p "$destination"
chmod 700 "$destination"
exec 9>"$destination/deployment.lock"
flock -n 9
sudo -n install -d -o kagla -g kagla -m 700 /backup/nexibase-home-releases
for file in deploy.py audit.py verify.cjs verify-demo.cjs browser-check.cjs config.json README.md package.json package-lock.json; do
  install -m 600 "$file" "$destination/$file"
done
install -m 755 deploy-nexibase-home /home/kagla/deploy-nexibase-home
install -m 755 check-nexibase-deployment /home/kagla/check-nexibase-deployment
nodebin=/home/kagla/.local/share/fnm/node-versions/v24.19.0/installation/bin
export PATH="$nodebin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$destination/.browsers"
(cd "$destination" && npm ci --ignore-scripts && node node_modules/playwright/cli.js install chromium --only-shell)
python3 - <<'PY'
import json,pathlib,subprocess
destination=pathlib.Path('/home/kagla/nexibase-home-deploy')
state=destination/'state.json'
if not state.exists():
    active=subprocess.check_output(['systemctl','show','nexibase-home.service','-p','WorkingDirectory','--value'],text=True).strip()
    expected='/backup/nexibase-deployments-v0341-20261023/home-v0341'
    if active != expected:
        raise SystemExit('Bootstrap refused: reconcile current live official baseline first')
    if json.loads((pathlib.Path(active)/'package.json').read_text())['version'] != '0.34.1':
        raise SystemExit('Bootstrap version mismatch')
    state.write_text(json.dumps({'active':active,'official_commit':'1ab72ce3653f3488b3fe1b3294002082df5917c3','ref':'v0.34.1'},indent=2)+'\n')
    state.chmod(0o600)
PY
sudo -n install -m 644 nexibase-demo-deployment-check.service /etc/systemd/system/nexibase-demo-deployment-check.service
sudo -n install -d -m 755 /etc/systemd/system/nexibase-demo.service.d
sudo -n install -m 644 demo-post-deploy.conf /etc/systemd/system/nexibase-demo.service.d/zzzzzzzzzz-post-deploy-check.conf
sudo -n systemctl daemon-reload
# Retire the previous one-off entry points, retaining private copies for audit.
for old in /backup/nexibase-deployments-v0341-20261023/deploy.sh /backup/nexibase-deployments-20261023/deploy-v0340.sh; do
  if [ -f "$old" ] && ! grep -q 'deploy-nexibase-home' "$old"; then
    cp -p "$old" "$old.legacy-before-preservation"
    chmod 600 "$old.legacy-before-preservation"
    printf '#!/bin/sh\nset -eu\n# Superseded: use prepare/deploy --ref vX.Y.Z (home only).\nexec /home/kagla/deploy-nexibase-home "$@"\n' > "$old"
    chmod 700 "$old"
  fi
done
printf 'Installed deployment tools and demo startup audit hook; live processes unchanged.\n'
