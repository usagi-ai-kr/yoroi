#!/usr/bin/env python3
"""stop_checkpoint.py 회귀 테스트."""
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from stop_checkpoint import check_text, main, parse_inflight  # noqa: E402


def run(*argv):
    with redirect_stdout(StringIO()) as out:
        code = main(list(argv))
    return code, out.getvalue()


class StopCheckpointTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.out = str(Path(self.dir.name) / "stop.md")

    def tearDown(self):
        self.dir.cleanup()

    def test_create_and_check(self):
        code, _ = run("create", self.out, "--reason", "사용자 중단",
                      "--inflight", "wiki push=완료", "--pending", "PR 병합")
        self.assertEqual(code, 0)
        text = Path(self.out).read_text(encoding="utf-8")
        self.assertIn("## 상태: 재개 금지", text)
        self.assertIn("- wiki push: 완료", text)
        self.assertEqual(run("check", self.out)[0], 0)

    def test_no_overwrite_without_force(self):
        run("create", self.out, "--reason", "a")
        code, out = run("create", self.out, "--reason", "b")
        self.assertEqual(code, 1)
        self.assertIn("--force", out)
        self.assertEqual(run("create", self.out, "--reason", "b", "--force")[0], 0)

    def test_inflight_status_validation(self):
        self.assertEqual(parse_inflight(["a=b=완료"])[0], [("a=b", "완료")])
        for bad in ("push", "push=진행", "=완료"):
            self.assertTrue(parse_inflight([bad])[1])

    def test_rejects_secret_and_missing_sections(self):
        code, out = run("create", self.out, "--reason", "ghp_" + "A" * 36)
        self.assertEqual(code, 1)
        self.assertFalse(Path(self.out).exists())
        self.assertTrue(any("누락" in e for e in check_text("# 빈 문서")))
        self.assertEqual(run("check", self.out + ".none")[0], 1)


if __name__ == "__main__":
    unittest.main()
