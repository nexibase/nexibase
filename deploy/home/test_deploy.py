import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest import mock

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

    def tearDown(self):
        shutil.rmtree(self.root)

    def put(self, folder, name, content):
        target = folder / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)

    def merge(self):
        for name, source in deploy.files(self.current).items():
            target = self.output / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
        return deploy.merge_sources(self.base, self.current, self.incoming, self.output)

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
        operation.check_active = lambda: self.current
        try:
            with mock.patch.object(operation, 'preview') as preview, mock.patch.object(deploy, 'run') as commands:
                with self.assertRaisesRegex(RuntimeError, 'changed after verification'):
                    operation.activate(candidate)
                preview.assert_not_called()
                commands.assert_not_called()
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


if __name__ == '__main__':
    unittest.main()
