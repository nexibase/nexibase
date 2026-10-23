#!/bin/bash
# Run from this directory on gnuboard.net as kagla. No live service restart.
set -euo pipefail
cd "$(dirname "$0")"
destination=/home/kagla/nexibase-home-deploy
mkdir -p "$destination"
chmod 700 "$destination"
sudo -n install -d -o kagla -g kagla -m 700 /backup/nexibase-home-releases
for file in deploy.py verify.cjs config.json README.md; do
  install -m 600 "$file" "$destination/$file"
done
install -m 755 deploy-nexibase-home /home/kagla/deploy-nexibase-home
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
# Retire the previous one-off entry points, retaining private copies for audit.
for old in /backup/nexibase-deployments-v0341-20261023/deploy.sh /backup/nexibase-deployments-20261023/deploy-v0340.sh; do
  if [ -f "$old" ] && ! grep -q 'deploy-nexibase-home' "$old"; then
    cp -p "$old" "$old.legacy-before-preservation"
    chmod 600 "$old.legacy-before-preservation"
    printf '#!/bin/sh\nset -eu\n# Superseded: use prepare/deploy --ref vX.Y.Z (home only).\nexec /home/kagla/deploy-nexibase-home "$@"\n' > "$old"
    chmod 700 "$old"
  fi
done
printf 'Installed /home/kagla/deploy-nexibase-home; live service unchanged.\n'
