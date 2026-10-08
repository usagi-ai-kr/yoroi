#!/usr/bin/env python3
"""scripts/version.py 회귀 테스트. 임시 manifest만 사용하고 실제 저장소를 바꾸지 않는다."""
import glob, json, subprocess, sys, tempfile, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "version.py"


def run(*args):
    return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True)


class VersionTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="version-")
        self.addCleanup(self.tmp.cleanup)
        self.manifest = Path(self.tmp.name) / "package.json"

    def write(self, version):
        data = {"name": "tmp", "version": version, "scripts": {"test": "x"}}
        self.manifest.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return self.manifest.read_text(encoding="utf-8")

    def test_read_only_default(self):
        before = self.write("0.1.0")
        result = run("--manifest", str(self.manifest))
        self.assertEqual(result.returncode, 0)
        self.assertIn("tag(예정): v0.1.0", result.stdout)
        self.assertEqual(self.manifest.read_text(encoding="utf-8"), before)

    def test_bump_dry_run_changes_nothing(self):
        for part, target in (("patch", "0.1.1"), ("minor", "0.2.0"), ("major", "1.0.0")):
            before = self.write("0.1.0")
            result = run("--manifest", str(self.manifest), "--bump", part)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(f"dry-run: 0.1.0 -> {target}", result.stdout)
            self.assertEqual(self.manifest.read_text(encoding="utf-8"), before)

    def test_bump_resets_lower_components(self):
        self.write("0.9.3")
        self.assertIn("0.10.0", run("--manifest", str(self.manifest), "--bump", "minor").stdout)
        self.write("0.9.3")
        self.assertIn("1.0.0", run("--manifest", str(self.manifest), "--bump", "major").stdout)

    def test_apply_updates_top_level_only(self):
        data = {"name": "tmp", "version": "0.1.0", "config": {"version": "0.1.0"},
                "nested": [{"version": "9.9.9"}]}
        self.manifest.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        result = run("--manifest", str(self.manifest), "--bump", "patch", "--apply")
        self.assertEqual(result.returncode, 0, result.stderr)
        after = json.loads(self.manifest.read_text(encoding="utf-8"))
        self.assertEqual((after["version"], after["config"]["version"],
                          after["nested"][0]["version"]), ("0.1.1", "0.1.0", "9.9.9"))
        self.assertEqual(self.manifest.read_text(encoding="utf-8")[-1], "\n")

    def test_apply_without_bump_rejected(self):
        before = self.write("0.1.0")
        self.assertEqual(run("--manifest", str(self.manifest), "--apply").returncode, 2)
        self.assertEqual(self.manifest.read_text(encoding="utf-8"), before)

    def test_invalid_semver_rejected(self):
        for bad in ("01.0.0", "1.02.0", "1.0", "1.0.0-beta.1", "v1.0.0", "1.0.0+build",
                    "a.b.c", "", "1.0.0 ", "\u0661.0.0", "1.\u0662.3", "1.0.\u0663"):
            self.write(bad)
            result = run("--manifest", str(self.manifest))
            self.assertEqual(result.returncode, 1, bad)
            self.assertIn("ERROR", result.stdout, bad)

    def test_bad_manifest_rejected_without_traceback(self):
        for text in ("{not json", "[1, 2]", "null", '"0.1.0"', "1", '{"version": null}',
                     '{"version": 1}', '{"version": ["0.1.0"]}', "{}"):
            self.manifest.write_text(text, encoding="utf-8")
            result = run("--manifest", str(self.manifest))
            self.assertEqual(result.returncode, 1, text)
            self.assertIn("ERROR", result.stdout, text)
            self.assertNotIn("Traceback", result.stderr + result.stdout, text)
        missing = run("--manifest", str(self.manifest) + ".absent")
        self.assertEqual(missing.returncode, 1)
        self.assertNotIn("Traceback", missing.stderr)

    def test_no_new_version_file_created(self):
        self.write("0.1.0")
        run("--manifest", str(self.manifest), "--bump", "minor", "--apply")
        created = [p for p in glob.glob(str(Path(self.tmp.name) / "*"))
                   if Path(p).name != "package.json"]
        self.assertEqual(created, [])

    def test_repository_dry_run_keeps_manifest(self):
        repo_manifest = ROOT / "package.json"
        before = repo_manifest.read_text(encoding="utf-8")
        result = run("--manifest", str(repo_manifest), "--bump", "patch")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(repo_manifest.read_text(encoding="utf-8"), before)
        self.assertIn("dry-run", result.stdout)


if __name__ == "__main__":
    unittest.main()
