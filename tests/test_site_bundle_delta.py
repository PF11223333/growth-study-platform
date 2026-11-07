import importlib.util
import json
from pathlib import Path
import stat
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("site_delta", Path(__file__).resolve().parents[1] / "scripts/site-bundle-delta.py")
delta = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delta)


class DeltaTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.base = self.root / "base.zip"
        self.target = self.root / "target.zip"
        self.patch = self.root / "patch.zip"
        self.output = self.root / "site"
        self.old = {"index.html": b"old", "version.json": b'{"version":49}', "assets/old.js": b"old js", "previews/page.webp": b"unchanged image" * 1000}
        self.new = {"index.html": b"new", "version.json": b'{"version":50}', "assets/new.js": b"new js", "previews/page.webp": self.old["previews/page.webp"], "data/中文.json": '原文完整'.encode()}
        self.zip(self.base, self.old)
        self.zip(self.target, self.new)

    def tearDown(self):
        self.tmp.cleanup()

    @staticmethod
    def zip(file, items):
        with zipfile.ZipFile(file, "w") as archive:
            for name, value in items.items():
                archive.writestr(name, value)

    def build(self):
        return delta.build(self.base, self.target, self.patch, "site-v49-test")

    def mutate_patch(self, fn):
        with zipfile.ZipFile(self.patch) as archive:
            items = {info.filename: archive.read(info) for info in archive.infolist()}
        fn(items)
        self.zip(self.patch, items)

    def bad_manifest(self, fn):
        def mutate(items):
            manifest = json.loads(items[delta.MANIFEST])
            fn(manifest)
            items[delta.MANIFEST] = json.dumps(manifest).encode()
        self.mutate_patch(mutate)

    def test_exact_reconstruction_and_deletion(self):
        report = self.build()
        self.assertEqual(report["changed"], 4)
        self.assertEqual(report["deleted"], 1)
        self.assertLess(report["bytes"], self.target.stat().st_size)
        result = delta.apply(self.base, self.patch, self.output)
        self.assertTrue(result["verified"])
        actual = {p.relative_to(self.output).as_posix(): p.read_bytes() for p in self.output.rglob("*") if p.is_file()}
        self.assertEqual(actual, self.new)
        self.assertFalse((self.output / "assets/old.js").exists())

    def test_existing_site_and_inputs_never_overwritten(self):
        self.build()
        self.output.mkdir()
        sentinel = self.output / "retain.txt"
        sentinel.write_text("user files")
        with self.assertRaisesRegex(ValueError, "must not exist"):
            delta.apply(self.base, self.patch, self.output)
        self.assertEqual(sentinel.read_text(), "user files")
        with self.assertRaises(ValueError):
            self.build()

    def test_wrong_base_rejected_before_any_site_creation(self):
        self.build()
        with self.base.open("ab") as stream:
            stream.write(b"unexpected")
        with self.assertRaisesRegex(ValueError, "Base archive SHA-256"):
            delta.apply(self.base, self.patch, self.output)
        self.assertFalse(self.output.exists())

    def test_corrupt_changed_payload_and_readback_hash_rejected(self):
        self.build()
        self.mutate_patch(lambda items: items.update({"payload/index.html": b"bad"}))
        with self.assertRaisesRegex(ValueError, "Payload SHA-256"):
            delta.apply(self.base, self.patch, self.output)
        self.assertFalse(self.output.exists())
        self.assertFalse(list(self.root.glob("site.staging-*")))

    def test_unchanged_file_hash_also_verified(self):
        self.build()
        self.bad_manifest(lambda m: next(row for row in m["files"] if row["path"] == "previews/page.webp").update(sha256="0" * 64))
        with self.assertRaisesRegex(ValueError, "Payload SHA-256"):
            delta.apply(self.base, self.patch, self.output)
        self.assertFalse(self.output.exists())

    def test_extra_payload_and_traversal_are_rejected(self):
        self.build()
        self.mutate_patch(lambda items: items.update({"payload/../../escape": b"unsafe"}))
        with self.assertRaisesRegex(ValueError, "archive path"):
            delta.apply(self.base, self.patch, self.output)
        self.assertFalse((self.root.parent / "escape").exists())

    def test_incomplete_deletion_manifest_rejected(self):
        self.build()
        self.bad_manifest(lambda m: m.update(deleted=[]))
        with self.assertRaisesRegex(ValueError, "inventory mismatch"):
            delta.apply(self.base, self.patch, self.output)

    def test_version_json_must_match_manifest(self):
        self.build()
        self.bad_manifest(lambda m: m.update(targetVersion={"version": 999}))
        with self.assertRaisesRegex(ValueError, "version mismatch"):
            delta.apply(self.base, self.patch, self.output)

    def test_unsafe_zip_names_and_symlinks_rejected(self):
        for name in ["../escape", "/absolute", "C:/drive", "folder\\file", "a//b", "a/./b", "a/../b", "a/CON", "a/trailing."]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                delta.safe_path(name)
        with zipfile.ZipFile(self.base, "a") as archive:
            link = zipfile.ZipInfo("danger")
            link.create_system = 3
            link.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(link, "../../escape")
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            self.build()

    def test_duplicate_case_and_parent_file_collision_rejected(self):
        for entries in [{"A": b"a", "a": b"b"}, {"a": b"a", "a/b": b"b"}]:
            with self.subTest(entries=entries):
                self.zip(self.base, entries)
                with zipfile.ZipFile(self.base) as archive, self.assertRaises(ValueError):
                    delta.archive_entries(archive)


if __name__ == "__main__":
    unittest.main()
