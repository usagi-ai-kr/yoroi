#!/usr/bin/env python3
"""ci-scope / validate-repo --ci 회귀 10케이스. 네트워크 불필요."""
import importlib.util, json, subprocess, sys, tempfile, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SCOPE = ROOT / "scripts" / "ci-scope.py"
ZERO = "0" * 40


def run(*a): return subprocess.run(a, check=True, capture_output=True, text=True).stdout
def git(repo, *a): return run("git", "-C", str(repo), *a)
def scope(repo, *a): return json.loads(run(sys.executable, str(SCOPE), "--repo", str(repo), *a))
def write(repo, name):
    (repo / name).parent.mkdir(parents=True, exist_ok=True)
    (repo / name).write_text("x")
def commit(repo, msg="change"):
    git(repo, "add", "-A")
    if subprocess.run(["git", "-C", str(repo), "diff", "--cached", "--quiet"]).returncode:
        git(repo, "commit", "-qm", msg)
    return git(repo, "rev-parse", "HEAD").strip()


class T(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="scope-")
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        for a in (["init", "-q"], ["config", "user.email", "t@t"], ["config", "user.name", "t"]):
            git(self.repo, *a)
    def pr(self, mutate, seeds=("seed.txt",)):
        for n in seeds: write(self.repo, n)
        base = commit(self.repo, "base")
        mutate()
        return scope(self.repo, "--event", "pull_request", "--base", base, "--head", commit(self.repo))
    def full(self, reason, *a):
        r = scope(self.repo, *a)
        self.assertEqual((r["full"], r["reason"]), (True, reason))
    def test_docs_only(self):
        self.assertTrue(self.pr(lambda: write(self.repo, "docs/a.md"))["docs_only"])
    def test_root_docs_space(self):
        for n in ("README.md", "AGENTS.md", "CLAUDE.md"):
            self.assertTrue(self.pr(lambda n=n: write(self.repo, n))["docs_only"], n)
        self.assertEqual(self.pr(lambda: write(self.repo, "docs/a b.md"))["files"], ["docs/a b.md"])
    def test_code_only(self):
        r = self.pr(lambda: write(self.repo, "src/a.ts"))
        self.assertEqual((r["docs_only"], r["full"]), (False, False))
    def test_mixed(self):
        r = self.pr(lambda: (write(self.repo, "src/a.ts"), write(self.repo, "docs/b.md")))
        self.assertEqual((r["docs_only"], r["link_scope"]), (False, True))
    def test_skills(self):
        r = self.pr(lambda: write(self.repo, ".agents/skills/x/SKILL.md"))
        self.assertEqual((r["skills"], r["docs_only"]), (True, False))
    def test_rename_code_to_docs(self):
        def move():
            write(self.repo, "docs/.keep")
            (self.repo / "seed.txt").rename(self.repo / "docs" / "seed.txt")
        r = self.pr(move)
        self.assertEqual(r["docs_only"], False)
        self.assertIn("seed.txt", r["files"])
    def test_rename_docs_to_code_delete(self):
        s = ("seed.txt", "docs/a.md")
        m = self.pr(lambda: (self.repo / "docs/a.md").rename(self.repo / "moved.ts"), s)
        d = self.pr(lambda: (self.repo / "docs/a.md").unlink(), s)
        self.assertEqual((m["docs_only"], d["docs_only"], d["full"]), (False, True, False))
    def test_push_boundaries(self):
        write(self.repo, "seed.txt"); base = commit(self.repo, "base")
        write(self.repo, "docs/a.md"); head = commit(self.repo)
        pushed = scope(self.repo, "--event", "push", "--before", base, "--after", head)
        self.assertTrue(pushed["docs_only"])
        self.full("initial-push", "--event", "push", "--before", ZERO, "--after", head)
        self.full("manual", "--event", "manual")
        self.full("git-error", "--event", "pull_request", "--base", "deadbeef", "--head", head)
    def test_empty_and_many(self):
        write(self.repo, "seed.txt"); base = commit(self.repo, "base")
        self.full("empty-diff", "--event", "push", "--before", base, "--after", base)
        many = self.pr(lambda: [write(self.repo, f"src/f{i}.ts") for i in range(1001)])
        self.assertEqual((len(many["files"]) >= 1001, many["docs_only"]), (True, False))
    def test_validate_repo_ci(self):
        spec = importlib.util.spec_from_file_location("vr", ROOT / "scripts" / "validate-repo.py")
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        self.assertTrue(all(m.ci_excludes_content(n) for n in
                            ("docs/x.md", "README.md", "AGENTS.md", "CLAUDE.md")))
        self.assertFalse(any(m.ci_excludes_content(n) for n in
                             (".agents/skills/a/SKILL.md", "src/main.ts")))
        c = subprocess.run([sys.executable, str(ROOT / "scripts" / "validate-repo.py"), "--ci"],
                           cwd=ROOT, capture_output=True)
        self.assertEqual(c.returncode, 0, c.stdout.decode() + c.stderr.decode())


if __name__ == "__main__":
    unittest.main()
