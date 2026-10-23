#!/usr/bin/env python3
"""Read-only post-deployment checks, also callable without deploying or restarting."""
import argparse
from contextlib import contextmanager
import datetime
import json
import os
from pathlib import Path
import subprocess
import time
from deploy import HERE, read_json, save, source_guard, Deployment


def active(service):
    return Path(subprocess.check_output(['systemctl', 'show', service, '-p', 'WorkingDirectory', '--value'], text=True).strip()).resolve()


@contextmanager
def demo_lock(config, target):
    if target != 'demo':
        yield
        return
    import fcntl
    with open(config['demo_reset_lock'], 'a') as lock:
        deadline = time.monotonic() + 30
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise RuntimeError('Demo reset is still running; verification did not complete')
                time.sleep(0.5)
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def audit(site, output=None, home_release=None, home_url=None):
    config = read_json(HERE / 'config.json')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    directory = Path(output) if output else HERE / 'reports' / (stamp + '-' + site)
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    env = dict(os.environ, PATH=str(Path(config['node']).parent) + ':' + os.environ['PATH'],
               PLAYWRIGHT_BROWSERS_PATH=str(HERE / '.browsers'))
    result = {'site': site, 'checked_at': stamp, 'checks': 'running', 'results': {}}
    def command(args, log):
        proc = subprocess.run([str(a) for a in args], env=env, stdout=log, stderr=log, timeout=150)
        if proc.returncode:
            raise RuntimeError('Automatic deployment verification failed; inspect ' + str(directory / 'audit.log'))
    try:
        with (directory / 'audit.log').open('w') as log:
            for target in (('home', 'demo') if site == 'all' else (site,)):
                release = Path(home_release).resolve() if target == 'home' and home_release else active(config['service' if target == 'home' else 'demo_service'])
                url = (home_url or config['public_url']) if target == 'home' else config['demo_url']
                Deployment.wait_http(url)
                site_dir = directory / target
                site_dir.mkdir(mode=0o700, exist_ok=True)
                with demo_lock(config, target):
                    if target == 'home':
                        source_guard(release)
                        command([config['node'], HERE / 'verify.cjs', release, site_dir / 'runtime.json', config['uploads'], url, '-'], log)
                    else:
                        command([config['node'], HERE / 'verify-demo.cjs', release, site_dir / 'runtime.json', url], log)
                    command([config['node'], HERE / 'browser-check.cjs', target, url, site_dir], log)
                result['results'][target] = {'checks': 'passed', 'release': str(release), 'url': url,
                                             'browser': read_json(site_dir / 'browser.json')['details']}
        result['checks'] = 'passed'
    except Exception as error:
        result['checks'] = 'failed'
        result['error'] = str(error)
        raise
    finally:
        save(directory / 'result.json', result)
        # Last result per scope; each run also has a separate report directory.
        save(HERE / 'reports' / ('latest-' + site + '.json'), dict(result, report=str(directory)))
    return directory


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', choices=['home', 'demo', 'all'], default='all')
    parser.add_argument('--output')
    parser.add_argument('--home-release')
    parser.add_argument('--home-url')
    args = parser.parse_args()
    os.umask(0o077)
    directory = audit(args.site, args.output, args.home_release, args.home_url)
    print(json.dumps({'checks': 'passed', 'site': args.site, 'report': str(directory)}), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('POST-DEPLOY CHECK FAILED: ' + str(error), flush=True)
        raise SystemExit(1)
