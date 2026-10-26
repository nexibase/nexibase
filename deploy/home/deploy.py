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
import uuid

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
    offset = None
    if log is not None:
        log.flush()
        offset = log.tell()
    result = subprocess.run([str(a) for a in args], cwd=cwd, env=env,
                            stdout=subprocess.PIPE if capture else log,
                            stderr=subprocess.PIPE if capture else log, check=False)
    if check and result.returncode:
        detail = ''
        if offset is not None:
            try:
                with open(log.name, errors='replace') as source:
                    source.seek(offset)
                    lines = [line.strip() for line in source.read(16000).splitlines() if line.strip()]
                detail = next((line for line in lines if any(word in line.lower() for word in
                              ('error', 'failed', 'missing', 'mismatch', 'expected', 'contains', 'timeout', 'unable'))), '')
            except OSError:
                pass
        suffix = ': ' + safe_message(detail) if detail else '; inspect private deployment logs'
        raise RuntimeError(f'Command failed ({result.returncode}): {args[0]}' + suffix)
    return result


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name('.report-' + uuid.uuid4().hex + '.pending')
    try:
        with temporary.open('x', encoding='utf-8') as output:
            output.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        temporary.chmod(0o600)
        for attempt in range(6):
            try:
                temporary.replace(path)
                break
            except PermissionError:
                # Windows can briefly deny replacement while another writer closes its handle.
                if os.name != 'nt' or attempt == 5:
                    raise
                time.sleep(0.01 * (attempt + 1))
    finally:
        temporary.unlink(missing_ok=True)


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def safe_message(value):
    text = str(value)
    text = re.sub(r'([a-z][a-z0-9+.-]*://)[^\s/@]+:[^\s/@]+@', r'\1[redacted]@', text, flags=re.I)
    text = re.sub(r'((?:[A-Z_]*(?:PASSWORD|SECRET|TOKEN)|DATABASE_URL)\s*[=:]\s*)("[^"]*"|\x27[^\x27]*\x27|[^\s,;]+)',
                  r'\1[redacted]', text, flags=re.I)
    return text[:3000]


def failure_info(error, stage, log):
    return {'type': type(error).__name__, 'stage': stage, 'message': safe_message(error), 'log': str(log)}


class ActivationReport:
    """A private report for each activation attempt, including attempts that stop before switching."""
    def __init__(self, job, service):
        identifier = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ-') + uuid.uuid4().hex[:8]
        self.job = job
        self.directory = HERE / 'reports/deployments' / identifier
        self.data = {
            'id': identifier, 'site': 'home', 'service': service, 'status': 'running', 'stage': 'preflight',
            'started_at': utc_now(), 'finished_at': None, 'previous_release': None,
            'attempted_release': str(job), 'current_release': None, 'service_active': None,
            'failure': None, 'recovery': {'attempted': False, 'status': 'not_attempted', 'failure': None},
            'report': str(self.directory), 'activation_log': str(job / 'tmp/activate.log'),
            'preview_checks_report': str(job / 'tmp/preview-checks/result.json'),
            'checks_report': str(job / 'tmp/post-deploy-checks/result.json'),
            'recovery_checks_report': str(job / 'tmp/recovery-checks/result.json'),
        }

    def context(self):
        return {key: self.data[key] for key in ('id', 'status', 'stage', 'previous_release',
                'attempted_release', 'current_release', 'service_active', 'failure')}

    def publish(self, required=True):
        self.data['updated_at'] = utc_now()
        try:
            save(self.directory / 'result.json', self.data)
            save(self.job / 'tmp/deployment-result.json', self.data)
            save(HERE / 'reports/latest-deployment.json', self.data)
            for name, scope in (('post-deploy-checks', 'all'), ('recovery-checks', 'home')):
                directory = self.job / 'tmp' / name
                path = directory / 'result.json'
                if not path.exists():
                    continue
                audit = read_json(path)
                if audit.get('deployment_id') != self.data['id']:
                    continue  # Never attach a new activation to a stale or unrelated check.
                audit.update(deployment=self.context(), recovery=self.data['recovery'])
                save(path, audit)
                latest = HERE / 'reports' / ('latest-' + scope + '.json')
                if latest.exists() and read_json(latest).get('report') == str(directory):
                    save(latest, dict(audit, report=str(directory)))
        except Exception as error:
            if required:
                raise
            # Reporting failure must not prevent restoration of the previous service.
            self.data.setdefault('reporting_errors', []).append(safe_message(error))
            print('RECOVERY REPORT WRITE FAILED: ' + safe_message(error), flush=True)


def merge_sources(base, current, incoming, output, resolutions=None):
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
        if ours == old or (old is not None and ours is not None and
                           old.replace(b'\r\n', b'\n') == ours.replace(b'\r\n', b'\n')):
            if new is None:
                target.unlink(missing_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(after[name], target)
        elif old is not None and ours is not None and new is not None and b'\0' not in old + ours + new:
            result = run(['git', 'merge-file', '-p', '--diff3', local[name], before[name], after[name]],
                         capture=True, check=False)
            if result.returncode:
                resolution = (resolutions or {}).get(name)
                if resolution is None:
                    conflicts.append(name)
                    continue
                for key, content in (('base', old), ('current', ours), ('incoming', new)):
                    if resolution.get(key + '_sha256') != hashlib.sha256(content).hexdigest():
                        raise RuntimeError('Reviewed merge inputs changed: ' + name)
                content = resolution.get('content')
                if not isinstance(content, str) or any(line.startswith(('<<<<<<< ', '||||||| ', '=======', '>>>>>>> '))
                                                       for line in content.splitlines()):
                    raise RuntimeError('Invalid reviewed merge content: ' + name)
                target.write_bytes(content.encode('utf-8'))
                changed.append(name)
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
        value = run(['systemctl', 'show', self.config['service'], '-p', 'WorkingDirectory', '--value'],
                    capture=True).stdout.decode().strip()
        if not value:
            raise RuntimeError('Service WorkingDirectory is unavailable')
        return Path(value).resolve()

    def observe(self, report):
        report.data['current_release'] = None
        report.data['service_active'] = None
        try:
            report.data['current_release'] = str(self.active())
            report.data['service_active'] = run(['systemctl', 'is-active', '--quiet', self.config['service']],
                                                 check=False, capture=True).returncode == 0
            report.data.pop('observation_error', None)
        except Exception as error:
            report.data['observation_error'] = safe_message(error)

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
        args = ['python3', HERE / 'audit.py', '--site', site, '--home-release', release,
                '--home-url', url, '--output', output]
        if getattr(self, '_activation_report', None):
            args.extend(['--deployment-report', self._activation_report.job / 'tmp/deployment-result.json'])
        run(args, log=self.log, env=self.env)

    def checkout(self, mirror, commit, dest):
        run(['git', 'clone', '--shared', '--no-checkout', mirror, dest], log=self.log)
        run(['git', 'remote', 'set-url', 'origin', self.config['repository']], cwd=dest, log=self.log)
        run(['git', 'checkout', '--detach', commit], cwd=dest, log=self.log)
        run(['git', 'submodule', 'update', '--init', '--recursive'], cwd=dest, log=self.log)

    def prepare(self, ref, resolutions=None):
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
        changed = merge_sources(base, active, incoming, job, resolutions)
        if resolutions:
            save(job / 'tmp/reviewed-merge-resolutions.json', resolutions)
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
        report = self._activation_report = ActivationReport(job, self.config['service'])
        switched = False
        state_commit_started = False
        active = None
        try:
            self.observe(report)
            report.data['previous_release'] = report.data['current_release']
            report.publish()  # Fail before touching services if reports cannot be persisted.
            active = self.check_active()
            report.data['previous_release'] = str(active)
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
            report.data['stage'] = 'preview_checks'
            report.publish()
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
            report.data['stage'] = 'service_switch'
            report.publish()
            switched = True  # Even a partial override installation requires restoration.
            run(['sudo', '-n', 'install', '-m', '644', conf, override], log=self.log)
            run(['sudo', '-n', 'systemctl', 'daemon-reload'], log=self.log)
            run(['sudo', '-n', 'systemctl', 'restart', self.config['service']], log=self.log)
            self.wait_http('http://localhost:' + str(self.config['port']))
            if self.active() != job:
                raise RuntimeError('Another systemd override took precedence')
            report.data['stage'] = 'post_deploy_checks'
            self.observe(report)
            report.publish()
            self.guard(job, job / 'tmp/live.json', self.config['public_url'], job / 'tmp/before.json')
            # Browser/UI + both sites' runtime checks must pass before publishing deployment state.
            self.audit(job, self.config['public_url'], job / 'tmp/post-deploy-checks', 'all')
            report.data.update(status='succeeded', stage='complete', finished_at=utc_now(),
                               recovery={'attempted': False, 'status': 'not_needed', 'failure': None})
            self.observe(report)
            if report.data['current_release'] != str(job) or not report.data['service_active']:
                raise RuntimeError('Verified deployment is no longer the active service')
            report.publish()
            report.data['stage'] = 'commit_state'
            state_commit_started = True
            save(self.state_path, {'active': str(job), 'official_commit': manifest['official_commit'],
                                   'ref': manifest['ref'], 'previous_active': str(active)})
            report.data['stage'] = 'complete'
        except BaseException as original:
            report.data['status'] = 'failed'
            report.data['failure'] = failure_info(original, report.data['stage'], job / 'tmp/activate.log')
            audit_path = job / 'tmp' / ('preview-checks' if report.data['stage'] == 'preview_checks' else 'post-deploy-checks') / 'result.json'
            if audit_path.exists():
                try:
                    audit_result = read_json(audit_path)
                    if audit_result.get('deployment_id') == report.data['id']:
                        report.data['failure']['cause'] = audit_result.get('failure') or audit_result.get('error')
                except Exception:
                    pass
            if switched:
                recovery = report.data['recovery'] = {'attempted': True, 'status': 'running',
                    'started_at': utc_now(), 'failure': None, 'stage': 'restore_override'}
                report.publish(required=False)
                try:
                    if old_override is None:
                        run(['sudo', '-n', 'rm', '--', override], log=self.log)
                    else:
                        run(['sudo', '-n', 'install', '-m', '644', job / 'tmp/previous-override.conf', override], log=self.log)
                    recovery['stage'] = 'restart_previous'
                    report.publish(required=False)
                    run(['sudo', '-n', 'systemctl', 'daemon-reload'], log=self.log)
                    run(['sudo', '-n', 'systemctl', 'restart', self.config['service']], log=self.log)
                    recovery['stage'] = 'verify_previous_path'
                    self.observe(report)
                    if report.data['current_release'] != str(active) or not report.data['service_active']:
                        raise RuntimeError('Recovery did not restore the previous active service path')
                    recovery['stage'] = 'verify_previous_http'
                    self.wait_http('http://localhost:' + str(self.config['port']))
                    recovery['stage'] = 'verify_previous_runtime'
                    self.guard(active, job / 'tmp/recovery-runtime.json', self.config['public_url'])
                    recovery['stage'] = 'verify_previous_browser'
                    report.publish(required=False)
                    # A demo failure must not prevent judging the restored home site's health.
                    self.audit(active, self.config['public_url'], job / 'tmp/recovery-checks', 'home')
                    self.observe(report)
                    if report.data['current_release'] != str(active) or not report.data['service_active']:
                        raise RuntimeError('Previous service changed during recovery verification')
                    if state_commit_started:
                        recovery['stage'] = 'restore_deployment_state'
                        if not self.state_path.exists() or read_json(self.state_path) != self.state:
                            save(self.state_path, self.state)
                    recovery.update(status='succeeded', stage='complete')
                except BaseException as recovery_error:
                    recovery.update(status='failed', failure=failure_info(recovery_error, recovery['stage'], job / 'tmp/activate.log'))
                    recovery_path = job / 'tmp/recovery-checks/result.json'
                    if recovery_path.exists():
                        try:
                            check = read_json(recovery_path)
                            if check.get('deployment_id') == report.data['id']:
                                recovery['failure']['cause'] = check.get('failure') or check.get('error')
                        except Exception:
                            pass
                finally:
                    recovery['finished_at'] = utc_now()
            else:
                report.data['recovery'] = {'attempted': False, 'status': 'not_attempted',
                                           'reason': 'service_was_not_changed', 'failure': None}
            self.observe(report)
            report.data['finished_at'] = utc_now()
            report.publish(required=False)
            print('RECOVERY STATUS: ' + report.data['recovery']['status'], flush=True)
            print('DEPLOYMENT REPORT: ' + str(report.directory / 'result.json'), flush=True)
            raise
        print('DEPLOYED AND VERIFIED: ' + manifest['ref'], flush=True)


def main():
    import fcntl
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'activate', 'deploy'])
    parser.add_argument('--ref')
    parser.add_argument('--release')
    parser.add_argument('--resolutions', type=Path, help='Private JSON with reviewed text conflicts and SHA-256 of all three inputs')
    args = parser.parse_args()
    if args.command in ('prepare', 'deploy') and not args.ref:
        parser.error('--ref is required')
    if args.command == 'activate' and not args.release:
        parser.error('--release is required')
    if args.command == 'activate' and args.resolutions:
        parser.error('--resolutions is only allowed during preparation')
    os.umask(0o077)
    with (HERE / 'deployment.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        deployment = Deployment()
        resolutions = read_json(args.resolutions) if args.resolutions else None
        job = deployment.prepare(args.ref, resolutions) if args.command != 'activate' else Path(args.release)
        if args.command != 'prepare':
            deployment.activate(job)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('DEPLOYMENT STOPPED: ' + str(error), flush=True)
        raise SystemExit(1)
