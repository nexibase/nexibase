#!/usr/bin/env python3
"""Site-only, copy/three-way-merge/verify/switch deployment. Never resets live source."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

HERE = Path(__file__).resolve().parent
SKIP_DIRS = {'.git', 'node_modules', '.next', 'tmp', 'logs', '.demo-snapshot', '__pycache__'}


def excluded(relative):
    return (any(p in SKIP_DIRS for p in relative.parts) or
            relative.parts[:2] == ('public', 'uploads') or
            relative.name.endswith(('.log', '.tsbuildinfo', '.pyc')))


def files(root):
    result = {}
    for directory, dirs, names in os.walk(root, followlinks=False):
        rel = Path(directory).relative_to(root)
        dirs[:] = [d for d in dirs if not excluded(rel / d)]
        for d in dirs:
            if (Path(directory) / d).is_symlink():
                raise RuntimeError(f'Unreviewed source symlink: {rel / d}')
        for name in names:
            relative = rel / name
            if excluded(relative):
                continue
            path = root / relative
            if path.is_symlink():
                raise RuntimeError(f'Unreviewed source symlink: {relative}')
            result[relative.as_posix()] = path
    return result


def digest_tree(root, source=True):
    if source:
        entries = files(root)
    else:
        entries = {p.relative_to(root).as_posix(): p for p in root.rglob('*')
                   if p.is_file() and 'cache' not in p.relative_to(root).parts}
    h = hashlib.sha256()
    for name, path in sorted(entries.items()):
        h.update(name.encode() + b'\0' + hashlib.sha256(path.read_bytes()).digest())
        h.update(str(path.stat().st_mode & 0o777).encode() + b'\0')
    return h.hexdigest()


def run(args, cwd=None, log=None, capture=False, check=True, env=None):
    result = subprocess.run([str(a) for a in args], cwd=cwd, env=env,
                            stdout=subprocess.PIPE if capture else log,
                            stderr=subprocess.PIPE if capture else log, check=False)
    if check and result.returncode:
        # Do not expose database URLs, env values or private query responses in errors.
        raise RuntimeError(f'Command failed ({result.returncode}): {args[0]}; inspect private deployment logs')
    return result


def read_json(path):
    return json.loads(path.read_text())


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.pending')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temporary.chmod(0o600)
    temporary.replace(path)


def merge_sources(base, current, incoming, output):
    """Apply only upstream deltas; keep every unrelated site file and local edit."""
    before, local, after = files(base), files(current), files(incoming)
    changed = []
    conflicts = []
    for name in sorted(before.keys() | after.keys()):
        if Path(name).name.startswith('.env') and name != '.env.example':
            raise RuntimeError('Upstream contains a private environment file')
        old = before[name].read_bytes() if name in before else None
        new = after[name].read_bytes() if name in after else None
        if old == new:
            continue
        ours = local[name].read_bytes() if name in local else None
        if ours == new:
            continue
        target = output / name
        if ours == old:
            if new is None:
                target.unlink(missing_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(after[name], target)
        elif old is not None and ours is not None and new is not None and b'\0' not in old + ours + new:
            result = run(['git', 'merge-file', '-p', '--diff3', local[name], before[name], after[name]],
                         capture=True, check=False)
            if result.returncode:
                conflicts.append(name)
                continue
            target.write_bytes(result.stdout)
        else:
            conflicts.append(name)
            continue
        changed.append(name)
    if conflicts:
        raise RuntimeError('Site/upstream merge conflict; live service unchanged: ' + ', '.join(conflicts))
    return changed


REQUIRED = {
    'src/app/api/showcase/route.ts': ['getPublicShowcase'],
    'src/lib/showcase.ts': ['getPublicShowcase'],
    'src/lib/showcase-preview.ts': ['getShowcasePreview'],
    'src/features/boards/components/ShowcaseCard.tsx': ['ShowcaseCard'],
    'src/features/boards/components/BoardListPage.tsx': ['ShowcaseCard'],
    'src/features/boards/components/BoardWritePage.tsx': ['showcase'],
    'src/widgets/ShowcaseSites.tsx': ['showcase-sites-title'],
    'src/widgets/ShowcaseSites.meta.ts': ['ssr: true'],
    'src/lib/widgets/prepare-home-data.ts': ['getPublicShowcase', 'initialShowcase'],
    'src/layouts/default/Header.tsx': ['mobileShowcaseMenu', 'md:hidden', '/boards/showcase'],
    'src/features/boards/components/BoardPostPage.tsx': ['<AvatarImage', '<AvatarFallback'],
    'src/components/GoogleAnalytics.tsx': ['ga-init'],
    'package.json': ['scripts/check-no-cookie-consent.cjs'],
    'AGENTS.md': ['nexibase.com', '쇼케이스'],
}


def source_guard(root):
    for name, markers in REQUIRED.items():
        path = root / name
        if not path.is_file() or any(m not in path.read_text() for m in markers):
            raise RuntimeError('Required site customization missing: ' + name)
    for language in ('ko', 'en'):
        if not read_json(root / f'src/locales/{language}.json')['boards'].get('showcase'):
            raise RuntimeError('Showcase translations missing')


def environment_guard(active, candidate):
    def environment(root):
        return {p.name: p.read_bytes() for p in root.glob('.env*') if p.name != '.env.example' and p.is_file()}
    if environment(active) != environment(candidate):
        raise RuntimeError('Private environment configuration changed; service switch blocked')


class Deployment:
    def __init__(self):
        self.config = read_json(HERE / 'config.json')
        self.state_path = HERE / 'state.json'
        self.state = read_json(self.state_path)
        self.root = Path(self.config['releases'])
        self.root.mkdir(parents=True, exist_ok=True)
        self.env = dict(os.environ, PATH=str(Path(self.config['node']).parent) + ':' + os.environ['PATH'])

    def active(self):
        return Path(run(['systemctl', 'show', self.config['service'], '-p', 'WorkingDirectory', '--value'],
                        capture=True).stdout.decode().strip()).resolve()

    def check_active(self):
        active = self.active()
        if active != Path(self.state['active']).resolve():
            raise RuntimeError('Live release changed outside this tool; reconcile the official baseline first')
        run(['systemctl', 'is-active', '--quiet', self.config['service']])
        if (active / 'public/uploads').resolve() != Path(self.config['uploads']).resolve():
            raise RuntimeError('Live shared uploads path changed')
        source_guard(active)
        return active

    def guard(self, release, snapshot, url=None, compare=None):
        args = [self.config['node'], HERE / 'verify.cjs', release, snapshot, self.config['uploads']]
        if url:
            args.extend([url, compare or '-'])
        run(args, log=self.log, env=self.env)

    def audit(self, release, url, output, site):
        run(['python3', HERE / 'audit.py', '--site', site, '--home-release', release,
             '--home-url', url, '--output', output], log=self.log, env=self.env)

    def checkout(self, mirror, commit, dest):
        run(['git', 'clone', '--shared', '--no-checkout', mirror, dest], log=self.log)
        run(['git', 'remote', 'set-url', 'origin', self.config['repository']], cwd=dest, log=self.log)
        run(['git', 'checkout', '--detach', commit], cwd=dest, log=self.log)
        run(['git', 'submodule', 'update', '--init', '--recursive'], cwd=dest, log=self.log)

    def prepare(self, ref):
        if not re.fullmatch(r'v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?', ref):
            raise RuntimeError('Use an explicit official release tag, e.g. v0.34.2')
        active = self.check_active()
        job = self.root / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + ref)
        job.mkdir(mode=0o700)
        (job / 'tmp').mkdir()
        self.log = (job / 'tmp/deploy.log').open('w')
        mirror = HERE / 'official.git'
        print('Preparing isolated release: ' + str(job), flush=True)
        if not mirror.exists():
            run(['git', 'clone', '--mirror', self.config['repository'], mirror], log=self.log)
        else:
            run(['git', 'fetch', '--prune', 'origin'], cwd=mirror, log=self.log)
        target = run(['git', 'rev-parse', '--verify', f'refs/tags/{ref}^{{commit}}'],
                     cwd=mirror, capture=True).stdout.decode().strip()
        run(['git', 'merge-base', '--is-ancestor', self.state['official_commit'], target], cwd=mirror, log=self.log)
        base, incoming = job / 'tmp/baseline', job / 'tmp/upstream'
        self.checkout(mirror, self.state['official_commit'], base)
        self.checkout(mirror, target, incoming)
        baseline_hash = digest_tree(active)
        for name, source in files(active).items():
            dest = job / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)
            if Path(name).name.startswith('.env') and name != '.env.example':
                dest.chmod(0o600)
        # Backups are private and never restored automatically over newer user data.
        self.guard(active, job / 'tmp/before.json')
        database = read_json(job / 'tmp/before.json')['database']
        if not re.fullmatch(r'[A-Za-z0-9_]+', database):
            raise RuntimeError('Invalid database name')
        import gzip
        with gzip.open(job / 'tmp/database-before.sql.gz', 'wb') as backup:
            proc = subprocess.Popen(['sudo', '-n', 'mariadb-dump', '--single-transaction', '--routines',
                                     '--triggers', '--events', '--hex-blob', database], stdout=subprocess.PIPE,
                                    stderr=self.log)
            shutil.copyfileobj(proc.stdout, backup)
            if proc.wait():
                raise RuntimeError('Database backup failed')
        (job / 'tmp/database-before.sql.gz').chmod(0o600)
        run(['tar', '-czf', job / 'tmp/uploads-before.tar.gz', '-C', self.config['uploads'], '.'], log=self.log)
        changed = merge_sources(base, active, incoming, job)
        source_guard(job)
        (job / 'public/uploads').mkdir(parents=True, exist_ok=True)
        print('Merged official changes; running tests and build (private logs in release/tmp).', flush=True)
        for command in (['npm', 'ci'], ['npx', 'prisma', 'migrate', 'status'], ['npm', 'test'],
                        ['npm', 'run', 'typecheck'], ['npm', 'run', 'build']):
            # migrate status is read-only. Pending schema migrations stop deployment for separate review.
            run(command, cwd=job, log=self.log, env=self.env)
        source_guard(job)
        environment_guard(active, job)
        run([self.config['node'], job / 'scripts/check-no-cookie-consent.cjs'], cwd=job, log=self.log)
        (job / 'public/uploads').rmdir()
        (job / 'public/uploads').symlink_to(self.config['uploads'], target_is_directory=True)
        self.preview(job, job / 'tmp/before.json')
        if self.active() != active or digest_tree(active) != baseline_hash:
            raise RuntimeError('Live source changed during preparation; prepare again')
        # Capture again after build/preview to prove no DB/settings/media mutation.
        self.guard(active, job / 'tmp/after-prepare.json', self.config['public_url'], job / 'tmp/before.json')
        manifest = {'active': str(active), 'previous_commit': self.state['official_commit'],
                    'official_commit': target, 'ref': ref, 'source_hash': digest_tree(job),
                    'build_hash': digest_tree(job / '.next', False), 'active_hash': baseline_hash,
                    'changes': changed, 'ready': True}
        save(job / 'tmp/ready.json', manifest)
        print('READY (live service unchanged): ' + str(job), flush=True)
        return job

    def preview(self, job, compare):
        unit = 'nexibase-home-preservation-preview'
        port = str(self.config['preview_port'])
        if run(['systemctl', 'is-active', '--quiet', unit], check=False).returncode == 0:
            raise RuntimeError('Preview port/unit already in use')
        try:
            run(['sudo', '-n', 'systemd-run', '--unit=' + unit, '--collect', '--property=User=kagla',
                 '--property=WorkingDirectory=' + str(job), '--setenv=NODE_ENV=production',
                 self.config['node'], job / 'node_modules/next/dist/bin/next', 'start',
                 '--hostname', 'localhost', '--port', port], log=self.log)
            self.wait_http('http://localhost:' + port)
            self.guard(job, job / 'tmp/preview.json', 'http://localhost:' + port, compare)
            self.audit(job, 'http://localhost:' + port, job / 'tmp/preview-checks', 'home')
        finally:
            run(['sudo', '-n', 'systemctl', 'stop', unit], log=self.log, check=False)

    @staticmethod
    def wait_http(url):
        import urllib.request
        for _ in range(40):
            try:
                with urllib.request.urlopen(url, timeout=3) as response:
                    if response.status == 200:
                        return
            except Exception:
                time.sleep(1)
        raise RuntimeError('Application did not become healthy')

    def activate(self, job):
        job = Path(job).resolve()
        if job.parent != self.root.resolve():
            raise RuntimeError('Candidate must be a direct child of configured releases directory')
        self.log = (job / 'tmp/activate.log').open('a')
        active = self.check_active()
        manifest = read_json(job / 'tmp/ready.json')
        if (not manifest['ready'] or manifest['active'] != str(active) or
                manifest['previous_commit'] != self.state['official_commit'] or
                manifest['active_hash'] != digest_tree(active) or
                manifest['source_hash'] != digest_tree(job) or
                manifest['build_hash'] != digest_tree(job / '.next', False)):
            raise RuntimeError('Candidate or live source changed after verification; prepare again')
        if manifest['official_commit'] == self.state['official_commit']:
            raise RuntimeError('Same-version preparation is a rehearsal; no service switch allowed')
        if (job / 'public/uploads').resolve() != Path(self.config['uploads']).resolve():
            raise RuntimeError('Candidate shared uploads missing')
        source_guard(job)
        environment_guard(active, job)
        self.preview(job, job / 'tmp/before.json')
        self.guard(active, job / 'tmp/pre-switch.json', self.config['public_url'], job / 'tmp/before.json')
        override = Path(self.config['override'])
        old_override = override.read_bytes() if override.exists() else None
        if old_override is not None:
            (job / 'tmp/previous-override.conf').write_bytes(old_override)
        conf = job / 'tmp/service.conf'
        conf.write_text('[Service]\nWorkingDirectory=' + str(job) + '\nExecStart=\nExecStart=' +
                        self.config['node'] + ' ' + str(job / 'node_modules/next/dist/bin/next') +
                        ' start --hostname localhost --port ' + str(self.config['port']) + '\n')
        try:
            run(['sudo', '-n', 'install', '-m', '644', conf, override], log=self.log)
            run(['sudo', '-n', 'systemctl', 'daemon-reload'], log=self.log)
            run(['sudo', '-n', 'systemctl', 'restart', self.config['service']], log=self.log)
            self.wait_http('http://localhost:' + str(self.config['port']))
            if self.active() != job:
                raise RuntimeError('Another systemd override took precedence')
            self.guard(job, job / 'tmp/live.json', self.config['public_url'], job / 'tmp/before.json')
            # Browser/UI + both sites' runtime checks must pass before publishing deployment state.
            self.audit(job, self.config['public_url'], job / 'tmp/post-deploy-checks', 'all')
            save(self.state_path, {'active': str(job), 'official_commit': manifest['official_commit'],
                                   'ref': manifest['ref'], 'previous_active': str(active)})
        except BaseException:
            if old_override is None:
                run(['sudo', '-n', 'rm', '--', override], log=self.log)
            else:
                run(['sudo', '-n', 'install', '-m', '644', job / 'tmp/previous-override.conf', override], log=self.log)
            run(['sudo', '-n', 'systemctl', 'daemon-reload'], log=self.log)
            run(['sudo', '-n', 'systemctl', 'restart', self.config['service']], log=self.log)
            self.wait_http('http://localhost:' + str(self.config['port']))
            raise
        print('DEPLOYED AND VERIFIED: ' + manifest['ref'], flush=True)


def main():
    import fcntl
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'activate', 'deploy'])
    parser.add_argument('--ref')
    parser.add_argument('--release')
    args = parser.parse_args()
    if args.command in ('prepare', 'deploy') and not args.ref:
        parser.error('--ref is required')
    if args.command == 'activate' and not args.release:
        parser.error('--release is required')
    os.umask(0o077)
    with (HERE / 'deployment.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        deployment = Deployment()
        job = deployment.prepare(args.ref) if args.command != 'activate' else Path(args.release)
        if args.command != 'prepare':
            deployment.activate(job)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('DEPLOYMENT STOPPED: ' + str(error), flush=True)
        raise SystemExit(1)
