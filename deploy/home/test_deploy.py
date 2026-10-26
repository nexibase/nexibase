import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest import mock
from types import SimpleNamespace
from contextlib import redirect_stdout
import io
from concurrent.futures import ThreadPoolExecutor

spec = importlib.util.spec_from_file_location('deploy', Path(__file__).with_name('deploy.py'))
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class PreservationTests(unittest.TestCase):
    def setUp(self):
        temporary = Path(__file__).resolve().parents[2] / 'tmp/deploy-tests'
        temporary.mkdir(parents=True, exist_ok=True)
        self.root = Path(tempfile.mkdtemp(dir=temporary))
        self.base, self.current, self.incoming, self.output = [self.root / n for n in ('base', 'current', 'incoming', 'output')]
        for folder in (self.base, self.current, self.incoming, self.output):
            folder.mkdir()
        self.control = self.root / 'control'
        self.control.mkdir()
        self.here_patch = mock.patch.object(deploy, 'HERE', self.control)
        self.here_patch.start()
        self.stdout_capture = redirect_stdout(io.StringIO())
        self.stdout_capture.__enter__()

    def tearDown(self):
        self.here_patch.stop()
        self.stdout_capture.__exit__(None, None, None)
        shutil.rmtree(self.root)

    def put(self, folder, name, content):
        target = folder / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)

    def merge(self, resolutions=None):
        for name, source in deploy.files(self.current).items():
            target = self.output / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
        return deploy.merge_sources(self.base, self.current, self.incoming, self.output, resolutions)

    def test_line_endings_alone_do_not_conflict_with_official_update(self):
        (self.base / 'package.json').write_bytes(b'{\n  "version": "1.0.0"\n}\n')
        (self.current / 'package.json').write_bytes(b'{\r\n  "version": "1.0.0"\r\n}\r\n')
        (self.incoming / 'package.json').write_bytes(b'{\n  "version": "1.0.1"\n}\n')
        self.merge()
        self.assertEqual((self.output / 'package.json').read_bytes(), (self.incoming / 'package.json').read_bytes())
        self.assertIn(b'\r\n', (self.current / 'package.json').read_bytes())

    def reviewed_conflict(self, content='site and official\n'):
        for folder, value in ((self.base, 'base\n'), (self.current, 'site\n'), (self.incoming, 'official\n')):
            self.put(folder, 'guide.md', value)
        resolution = {key + '_sha256': deploy.hashlib.sha256((folder / 'guide.md').read_bytes()).hexdigest()
                      for key, folder in (('base', self.base), ('current', self.current), ('incoming', self.incoming))}
        return {'guide.md': dict(resolution, content=content)}

    def test_reviewed_resolution_only_changes_candidate(self):
        self.merge(self.reviewed_conflict())
        self.assertEqual((self.output / 'guide.md').read_text(), 'site and official\n')
        self.assertEqual((self.current / 'guide.md').read_text(), 'site\n')

    def test_stale_resolution_is_blocked(self):
        resolutions = self.reviewed_conflict()
        self.put(self.current, 'guide.md', 'new site edit\n')
        with self.assertRaisesRegex(RuntimeError, 'inputs changed'):
            self.merge(resolutions)

    def test_resolution_cannot_retain_conflict_markers(self):
        resolutions = self.reviewed_conflict('<<<<<<< site\nunresolved\n')
        with self.assertRaisesRegex(RuntimeError, 'Invalid reviewed'):
            self.merge(resolutions)

    def test_reviewing_one_conflict_does_not_ignore_another(self):
        resolutions = self.reviewed_conflict()
        for folder, value in ((self.base, 'base'), (self.current, 'site'), (self.incoming, 'official')):
            self.put(folder, 'other.md', value)
        with self.assertRaisesRegex(RuntimeError, 'merge conflict.*other.md'):
            self.merge(resolutions)

    def test_nonoverlapping_changes_and_site_only_files_survive(self):
        text = ''.join(f'line {i}\n' for i in range(30))
        self.put(self.base, 'header.tsx', text)
        self.put(self.current, 'header.tsx', text.replace('line 2\n', 'mobile showcase\n'))
        self.put(self.incoming, 'header.tsx', text.replace('line 27\n', 'official fix\n'))
        self.put(self.current, 'widgets/Showcase.tsx', 'site widget')
        self.merge()
        result = (self.output / 'header.tsx').read_text()
        self.assertIn('mobile showcase', result)
        self.assertIn('official fix', result)
        self.assertEqual((self.output / 'widgets/Showcase.tsx').read_text(), 'site widget')

    def test_conflicting_edit_stops_without_touching_live_source(self):
        for folder, content in [(self.base, 'base'), (self.current, 'site'), (self.incoming, 'official')]:
            self.put(folder, 'header.tsx', content)
        with self.assertRaisesRegex(RuntimeError, 'merge conflict'):
            self.merge()
        self.assertEqual((self.current / 'header.tsx').read_text(), 'site')

    def test_upstream_delete_of_customized_file_is_blocked(self):
        self.put(self.base, 'widget.tsx', 'old')
        self.put(self.current, 'widget.tsx', 'customized')
        with self.assertRaisesRegex(RuntimeError, 'merge conflict'):
            self.merge()

    def test_upstream_addition_colliding_with_site_file_is_blocked(self):
        self.put(self.current, 'widget.tsx', 'site')
        self.put(self.incoming, 'widget.tsx', 'official')
        with self.assertRaisesRegex(RuntimeError, 'merge conflict'):
            self.merge()

    def test_upstream_addition_and_clean_delete(self):
        for folder in (self.base, self.current):
            self.put(folder, 'obsolete.txt', 'old')
        self.put(self.incoming, 'fix.txt', 'fix')
        self.merge()
        self.assertFalse((self.output / 'obsolete.txt').exists())
        self.assertEqual((self.output / 'fix.txt').read_text(), 'fix')

    def test_private_environment_in_upstream_is_blocked(self):
        self.put(self.incoming, '.env.production', 'private')
        with self.assertRaisesRegex(RuntimeError, 'private environment'):
            self.merge()

    def test_missing_showcase_blocks_candidate(self):
        with self.assertRaisesRegex(RuntimeError, 'customization missing'):
            deploy.source_guard(self.output)

    def test_uploads_and_build_output_are_excluded_from_source_copy(self):
        for name in ('public/uploads/logo.webp', 'node_modules/x', '.next/server/x', 'tmp/private'):
            self.put(self.current, name, 'runtime')
        self.put(self.current, '.env', 'private')
        self.assertEqual(set(deploy.files(self.current)), {'.env'})

    def test_source_tampering_changes_verification_digest(self):
        self.put(self.current, 'header.tsx', 'mobile showcase')
        before = deploy.digest_tree(self.current)
        self.put(self.current, 'header.tsx', 'removed')
        self.assertNotEqual(before, deploy.digest_tree(self.current))

    def test_tampered_ready_candidate_cannot_reach_service_switch(self):
        candidate = self.root / 'candidate'
        (candidate / 'tmp').mkdir(parents=True)
        self.put(candidate, 'header.tsx', 'changed after preview')
        deploy.save(candidate / 'tmp/ready.json', {
            'ready': True, 'active': str(self.current), 'previous_commit': 'baseline',
            'active_hash': deploy.digest_tree(self.current), 'source_hash': 'verified-old-hash',
        })
        operation = deploy.Deployment.__new__(deploy.Deployment)
        operation.root = self.root
        operation.state = {'official_commit': 'baseline'}
        operation.config = {'service': 'test-home.service'}
        operation.check_active = lambda: self.current
        operation.active = lambda: self.current
        try:
            with mock.patch.object(operation, 'preview') as preview, mock.patch.object(deploy, 'run') as commands:
                with self.assertRaisesRegex(RuntimeError, 'changed after verification'):
                    operation.activate(candidate)
                preview.assert_not_called()
                self.assertFalse(any('sudo' in [str(a) for a in call.args[0]] for call in commands.call_args_list))
        finally:
            operation.log.close()

    def test_source_symlink_cannot_escape_release_copy(self):
        try:
            (self.current / 'outside').symlink_to(self.incoming, target_is_directory=True)
        except OSError:
            self.skipTest('Host does not permit symlink creation')
        with self.assertRaisesRegex(RuntimeError, 'source symlink'):
            deploy.files(self.current)

    def test_environment_change_after_build_is_blocked(self):
        self.put(self.current, '.env', 'DATABASE_URL=original')
        self.put(self.output, '.env', 'DATABASE_URL=replaced')
        with self.assertRaisesRegex(RuntimeError, 'environment configuration changed'):
            deploy.environment_guard(self.current, self.output)

    def exercise_activation(self, failure=True, recovery_error=None, old_override=True, tamper=False, report_write_error=False, state_commit_error=False):
        candidate = self.root / 'candidate'
        (candidate / 'tmp').mkdir(parents=True)
        (candidate / '.next').mkdir()
        self.put(candidate, '.next/BUILD_ID', 'built')
        uploads = candidate / 'public/uploads'
        uploads.mkdir(parents=True)
        override = self.root / 'service.conf'
        if old_override:
            override.write_text('previous service config')
        deploy.save(candidate / 'tmp/ready.json', {
            'ready': True, 'active': str(self.current), 'previous_commit': 'baseline',
            'official_commit': 'next-release', 'ref': 'v0.34.2',
            'active_hash': deploy.digest_tree(self.current),
            'source_hash': deploy.digest_tree(candidate),
            'build_hash': deploy.digest_tree(candidate / '.next', False),
        })
        operation = deploy.Deployment.__new__(deploy.Deployment)
        operation.root = self.root
        operation.state = {'official_commit': 'baseline'}
        operation.state_path = self.root / 'state.json'
        operation.state['active'] = str(self.current)
        operation.env = {}
        operation.config = {'uploads': str(uploads), 'override': str(override), 'node': '/node',
                            'port': 9119, 'public_url': 'https://nexibase.com', 'service': 'test-home.service'}
        operation.check_active = lambda: self.current
        service = {'current': self.current, 'running': True, 'restarts': 0}
        operation.active = lambda: service['current']
        calls = []
        def command(args, **kwargs):
            call = [str(a) for a in args]
            calls.append(call)
            if call == ['sudo', '-n', 'systemctl', 'restart', 'test-home.service']:
                service['restarts'] += 1
                if service['restarts'] == 1:
                    service['current'] = candidate
                elif recovery_error == 'restart':
                    service['running'] = False
                    raise RuntimeError('previous service restart failed')
                else:
                    service['current'] = self.root / 'unexpected' if recovery_error == 'path' else self.current
            return SimpleNamespace(returncode=0 if service['running'] else 1)
        def audit(release, url, output, site):
            failed = (output.name == 'post-deploy-checks' and failure) or (output.name == 'recovery-checks' and recovery_error == 'browser')
            message = 'administrator logo decode failed' if output.name == 'post-deploy-checks' else 'restored logo is broken'
            result = {'deployment_id': operation._activation_report.data['id'], 'checks': 'failed' if failed else 'passed'}
            if failed:
                result['failure'] = {'stage': 'home.browser', 'message': message}
            deploy.save(output / 'result.json', result)
            deploy.save(self.control / 'reports' / ('latest-' + site + '.json'), dict(result, report=str(output)))
            if failed:
                raise RuntimeError(message)
        if tamper:
            self.put(candidate, 'tampered.txt', 'modified after verification')
        error = None
        real_save = deploy.save
        storage_error = False
        def write(path, data):
            nonlocal storage_error
            if state_commit_error and path == operation.state_path and data.get('official_commit') == 'next-release':
                real_save(path, data)
                raise OSError('state commit interrupted after write')
            if report_write_error and not storage_error and data.get('recovery', {}).get('status') == 'running':
                storage_error = True
                raise OSError('simulated report write failure')
            return real_save(path, data)
        try:
            with mock.patch.object(deploy, 'run', side_effect=command), mock.patch.object(deploy, 'source_guard'), \
                 mock.patch.object(operation, 'preview'), mock.patch.object(operation, 'guard'), \
                 mock.patch.object(operation, 'wait_http'), \
                 mock.patch.object(operation, 'audit', side_effect=audit), mock.patch.object(deploy, 'save', side_effect=write):
                try:
                    operation.activate(candidate)
                except BaseException as raised:
                    error = raised
        finally:
            operation.log.close()
        return deploy.read_json(candidate / 'tmp/deployment-result.json'), error, calls, operation, candidate

    def test_post_deployment_failure_records_verified_recovery_and_preserves_original_cause(self):
        report, error, calls, operation, candidate = self.exercise_activation()
        self.assertIn('administrator logo decode failed', str(error))
        self.assertEqual(report['status'], 'failed')
        self.assertEqual(report['failure']['cause']['stage'], 'home.browser')
        self.assertEqual(report['recovery']['status'], 'succeeded')
        self.assertEqual(report['previous_release'], str(self.current))
        self.assertEqual(report['attempted_release'], str(candidate))
        self.assertEqual(report['current_release'], str(self.current))
        self.assertTrue(report['service_active'])
        self.assertFalse(operation.state_path.exists())
        self.assertEqual(sum(c == ['sudo', '-n', 'systemctl', 'restart', 'test-home.service'] for c in calls), 2)
        self.assertTrue(any('previous-override.conf' in ' '.join(c) and 'install' in c for c in calls))
        for path in (self.control / 'reports/latest-deployment.json', candidate / 'tmp/post-deploy-checks/result.json',
                     self.control / 'reports/latest-all.json'):
            saved = deploy.read_json(path)
            self.assertEqual(saved['recovery']['status'], 'succeeded')
        self.assertEqual(deploy.read_json(self.control / 'reports/latest-all.json')['checks'], 'failed')

    def test_restart_failure_records_both_failures_and_observed_path(self):
        report, error, _, operation, candidate = self.exercise_activation(recovery_error='restart')
        self.assertIn('administrator logo decode failed', str(error))
        self.assertIn('administrator logo decode failed', report['failure']['message'])
        self.assertEqual(report['recovery']['status'], 'failed')
        self.assertIn('previous service restart failed', report['recovery']['failure']['message'])
        self.assertEqual(report['current_release'], str(candidate))
        self.assertFalse(report['service_active'])
        self.assertFalse(operation.state_path.exists())

    def test_wrong_service_path_cannot_be_reported_as_recovered(self):
        report, _, _, _, _ = self.exercise_activation(recovery_error='path')
        self.assertEqual(report['recovery']['status'], 'failed')
        self.assertEqual(report['recovery']['failure']['stage'], 'verify_previous_path')
        self.assertEqual(report['current_release'], str(self.root / 'unexpected'))

    def test_restored_browser_failure_is_not_reported_as_success(self):
        report, _, _, _, _ = self.exercise_activation(recovery_error='browser')
        self.assertEqual(report['recovery']['status'], 'failed')
        self.assertEqual(report['recovery']['failure']['stage'], 'verify_previous_browser')
        self.assertIn('restored logo is broken', report['recovery']['failure']['message'])
        self.assertEqual(report['current_release'], str(self.current))

    def test_successful_deployment_records_no_recovery_needed(self):
        report, error, _, operation, candidate = self.exercise_activation(failure=False)
        self.assertIsNone(error)
        self.assertEqual(report['status'], 'succeeded')
        self.assertEqual(report['recovery']['status'], 'not_needed')
        self.assertEqual(report['current_release'], str(candidate))
        self.assertEqual(deploy.read_json(operation.state_path)['active'], str(candidate))

    def test_failure_before_switch_records_no_recovery_attempt(self):
        report, error, calls, _, _ = self.exercise_activation(tamper=True)
        self.assertIn('changed after verification', str(error))
        self.assertEqual(report['recovery']['status'], 'not_attempted')
        self.assertEqual(report['current_release'], str(self.current))
        self.assertFalse(any(c[0] == 'sudo' for c in calls))

    def test_first_override_recovery_removes_new_override(self):
        report, _, calls, _, _ = self.exercise_activation(old_override=False)
        self.assertEqual(report['recovery']['status'], 'succeeded')
        self.assertTrue(any(c[:4] == ['sudo', '-n', 'rm', '--'] for c in calls))

    def test_reporting_redacts_credentials(self):
        message = deploy.safe_message('mysql://user:privatepass@db/site NEXTAUTH_SECRET=privatekey token=privatejwt')
        for secret in ('privatepass', 'privatekey', 'privatejwt'):
            self.assertNotIn(secret, message)

    def test_a_reporting_error_does_not_prevent_service_restoration(self):
        report, _, _, _, _ = self.exercise_activation(report_write_error=True)
        self.assertEqual(report['recovery']['status'], 'succeeded')
        self.assertIn('simulated report write failure', report['reporting_errors'][0])
        self.assertEqual(report['current_release'], str(self.current))

    def test_interrupted_state_commit_restores_the_previous_official_baseline(self):
        report, error, _, operation, _ = self.exercise_activation(failure=False, state_commit_error=True)
        self.assertIn('state commit interrupted after write', str(error))
        self.assertEqual(report['status'], 'failed')
        self.assertEqual(report['failure']['stage'], 'commit_state')
        self.assertEqual(report['recovery']['status'], 'succeeded')
        self.assertEqual(deploy.read_json(operation.state_path), operation.state)

    def test_concurrent_atomic_report_writes_leave_complete_utf8_json(self):
        path = self.control / 'reports/latest.json'
        with ThreadPoolExecutor(max_workers=4) as workers:
            list(workers.map(lambda number: deploy.save(path, {'number': number, 'message': '복구 결과'}), range(30)))
        result = deploy.read_json(path)
        self.assertIn(result['number'], range(30))
        self.assertEqual(result['message'], '복구 결과')
        self.assertFalse(list(path.parent.glob('*.pending')))

    def test_stale_audit_result_is_not_annotated_as_a_new_deployment(self):
        candidate = self.root / 'candidate'
        candidate.mkdir()
        audit_dir = candidate / 'tmp/post-deploy-checks'
        old = {'deployment_id': 'older-attempt', 'checks': 'passed'}
        deploy.save(audit_dir / 'result.json', old)
        deploy.save(self.control / 'reports/latest-all.json', dict(old, report=str(audit_dir)))
        report = deploy.ActivationReport(candidate, 'test.service')
        report.publish()
        self.assertEqual(deploy.read_json(audit_dir / 'result.json'), old)
        self.assertEqual(deploy.read_json(self.control / 'reports/latest-all.json')['deployment_id'], 'older-attempt')

    def test_read_only_audit_failure_records_reason_and_path_without_claiming_recovery(self):
        import audit
        config = {'node': '/node', 'service': 'test-home.service', 'public_url': 'https://nexibase.com', 'uploads': '/uploads'}
        deploy.save(self.control / 'config.json', config)
        def command(args, **kwargs):
            failed = str(args[1]).endswith('browser-check.cjs')
            kwargs['stdout'].write('TimeoutError: administrator logo failed to decode\n' if failed else 'runtime passed\n')
            kwargs['stdout'].flush()
            return SimpleNamespace(returncode=1 if failed else 0)
        with mock.patch.object(audit, 'HERE', self.control), mock.patch.object(audit, 'active', return_value=self.current), \
             mock.patch.object(audit, 'source_guard'), mock.patch.object(audit.Deployment, 'wait_http'), \
             mock.patch.object(audit.subprocess, 'run', side_effect=command):
            with self.assertRaisesRegex(RuntimeError, 'administrator logo failed to decode'):
                audit.audit('home')
        result = deploy.read_json(self.control / 'reports/latest-home.json')
        self.assertEqual(result['checks'], 'failed')
        self.assertEqual(result['failed_check'], 'home.browser')
        self.assertEqual(result['failure']['exit_code'], 1)
        self.assertEqual(result['results']['home']['release'], str(self.current))
        self.assertEqual(result['recovery']['status'], 'not_applicable')


if __name__ == '__main__':
    unittest.main()
