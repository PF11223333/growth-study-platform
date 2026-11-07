"""Build/apply verified static-site deltas. Standard library only; no network calls.

The output directory must not exist. Reconstruction happens in a sibling staging
directory and is atomically renamed only after the entire final tree is checked.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tempfile
import zipfile

MAX_BYTES = 1024 ** 3
MAX_FILES = 50000
MANIFEST = "delta-manifest.json"


def digest_file(file):
    h = hashlib.sha256()
    with open(file, "rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def safe_path(name):
    if not isinstance(name, str) or not name or len(name) > 1000:
        raise ValueError("Invalid archive path")
    if "\\" in name or ":" in name or "\x00" in name or name.startswith("/"):
        raise ValueError("Unsafe archive path: " + repr(name))
    parts = name.split("/")
    if any(p in ("", ".", "..") or p.endswith((".", " ")) for p in parts):
        raise ValueError("Non-canonical archive path: " + repr(name))
    if any(re.fullmatch(r"(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", p) for p in parts):
        raise ValueError("Reserved archive path: " + repr(name))
    return name


def archive_entries(archive):
    entries = {}
    folded = set()
    total = 0
    for info in archive.infolist():
        name = safe_path(info.filename.rstrip("/") if info.is_dir() else info.filename)
        mode = info.external_attr >> 16
        kind = stat.S_IFMT(mode)
        if kind not in (0, stat.S_IFREG, stat.S_IFDIR) or info.flag_bits & 1:
            raise ValueError("Unsupported/encrypted archive entry: " + name)
        if info.is_dir():
            if kind == stat.S_IFREG:
                raise ValueError("Conflicting archive entry type")
            continue
        if kind == stat.S_IFDIR or name in entries or name.casefold() in folded:
            raise ValueError("Duplicate/conflicting archive entry: " + name)
        entries[name] = info
        folded.add(name.casefold())
        total += info.file_size
        if info.file_size > MAX_BYTES or total > MAX_BYTES + 16 * 1024 ** 2 or len(entries) > MAX_FILES:
            raise ValueError("Archive exceeds site bounds")
    names = set(entries)
    for name in names:
        if any(str(parent) in names for parent in PurePosixPath(name).parents if str(parent) != "."):
            raise ValueError("File/directory path collision")
    return entries


def hash_entry(archive, info):
    h = hashlib.sha256()
    length = 0
    with archive.open(info) as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
            length += len(block)
            if length > info.file_size or length > MAX_BYTES:
                raise ValueError("Entry size exceeds declaration")
    if length != info.file_size:
        raise ValueError("Entry size mismatch")
    return h.hexdigest()


def build(base_zip, target_zip, output, base_tag):
    if not re.fullmatch(r"site-v[0-9]+-[A-Za-z0-9-]+", base_tag):
        raise ValueError("Invalid base release tag")
    base_zip, target_zip, output = map(lambda p: Path(p).resolve(), (base_zip, target_zip, output))
    if output in (base_zip, target_zip):
        raise ValueError("Output cannot replace an input")
    if output.exists():
        raise ValueError("Patch output already exists")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".building")
    if temporary.exists():
        raise ValueError("Patch staging file already exists")
    try:
        with zipfile.ZipFile(base_zip) as base, zipfile.ZipFile(target_zip) as target:
            old, new = archive_entries(base), archive_entries(target)
            if "version.json" not in new or "index.html" not in new:
                raise ValueError("Target is not a complete website")
            if sum(i.file_size for i in new.values()) > MAX_BYTES:
                raise ValueError("Target exceeds 1 GiB")
            print("Hashing base entries", flush=True)
            old_hashes = {name: hash_entry(base, info) for name, info in old.items()}
            print("Hashing target entries", flush=True)
            files = [{"path": name, "size": info.file_size, "sha256": hash_entry(target, info)} for name, info in sorted(new.items())]
            changed = [row["path"] for row in files if old_hashes.get(row["path"]) != row["sha256"]]
            deleted = sorted(set(old) - set(new))
            manifest = {"schemaVersion": 1, "baseRelease": base_tag, "baseZip": {"size": base_zip.stat().st_size, "sha256": digest_file(base_zip)}, "targetVersion": json.loads(target.read("version.json")), "files": files, "changed": changed, "deleted": deleted}
            with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as patch:
                for name in changed:
                    with target.open(new[name]) as source, patch.open("payload/" + name, "w") as dest:
                        shutil.copyfileobj(source, dest, 1024 * 1024)
                patch.writestr(MANIFEST, json.dumps(manifest, ensure_ascii=False, separators=(",", ":")))
            os.replace(temporary, output)
        return {"patch": str(output), "baseRelease": base_tag, "files": len(files), "changed": len(changed), "deleted": len(deleted), "bytes": output.stat().st_size, "sha256": digest_file(output), "targetVersion": manifest["targetVersion"]}
    finally:
        if temporary.exists():
            temporary.unlink()


def read_manifest(patch, entries):
    info = entries.get(MANIFEST)
    if not info or info.file_size > 16 * 1024 ** 2:
        raise ValueError("Missing/oversized delta manifest")
    manifest = json.loads(patch.read(info))
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 1:
        raise ValueError("Unsupported delta schema")
    rows = manifest.get("files")
    if not isinstance(rows, list) or not rows or len(rows) > MAX_FILES:
        raise ValueError("Invalid final file manifest")
    final = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Invalid manifest record")
        name = safe_path(row.get("path"))
        if name in final or not isinstance(row.get("size"), int) or isinstance(row["size"], bool) or row["size"] < 0 or not re.fullmatch("[a-f0-9]{64}", str(row.get("sha256", ""))):
            raise ValueError("Invalid/duplicate manifest file")
        final[name] = row
    if len({name.casefold() for name in final}) != len(final) or sum(row["size"] for row in final.values()) > MAX_BYTES:
        raise ValueError("Invalid final tree size or names")
    for name in final:
        if any(str(p) in final for p in PurePosixPath(name).parents if str(p) != "."):
            raise ValueError("File/directory manifest collision")
    for key in ("changed", "deleted"):
        values = manifest.get(key)
        if not isinstance(values, list) or len(values) != len(set(values)):
            raise ValueError("Invalid " + key)
        for value in values:
            safe_path(value)
    if set(manifest["changed"]) - set(final) or set(manifest["deleted"]) & set(final):
        raise ValueError("Inconsistent changed/deleted manifest")
    if set(entries) != {MANIFEST} | {"payload/" + name for name in manifest["changed"]}:
        raise ValueError("Unexpected/missing patch payload")
    base = manifest.get("baseZip", {})
    if not isinstance(base, dict) or not isinstance(base.get("size"), int) or not re.fullmatch("[a-f0-9]{64}", str(base.get("sha256", ""))):
        raise ValueError("Missing base archive fingerprint")
    if not re.fullmatch(r"site-v[0-9]+-[A-Za-z0-9-]+", str(manifest.get("baseRelease", ""))):
        raise ValueError("Invalid base release")
    return manifest, final


def apply(base_zip, patch_zip, output_directory):
    base_zip, patch_zip, output = map(lambda p: Path(p).resolve(), (base_zip, patch_zip, output_directory))
    if output.exists():
        raise ValueError("Output directory must not exist; existing site is preserved")
    if output == output.parent or any(p == output or output in p.parents for p in (base_zip, patch_zip)):
        raise ValueError("Unsafe output location")
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = None
    try:
        with zipfile.ZipFile(patch_zip) as patch, zipfile.ZipFile(base_zip) as base:
            payload, originals = archive_entries(patch), archive_entries(base)
            manifest, final = read_manifest(patch, payload)
            if base_zip.stat().st_size != manifest["baseZip"]["size"] or digest_file(base_zip) != manifest["baseZip"]["sha256"]:
                raise ValueError("Base archive SHA-256 mismatch")
            changed, deleted = set(manifest["changed"]), set(manifest["deleted"])
            if deleted != set(originals) - set(final) or (set(originals) - deleted) | changed != set(final):
                raise ValueError("Base/delta final inventory mismatch")
            stage = Path(tempfile.mkdtemp(prefix=output.name + ".staging-", dir=output.parent))
            for name, row in final.items():
                archive, info = (patch, payload["payload/" + name]) if name in changed else (base, originals[name])
                if info.file_size != row["size"]:
                    raise ValueError("Payload size mismatch: " + name)
                target = stage.joinpath(*name.split("/"))
                target.parent.mkdir(parents=True, exist_ok=True)
                h, length = hashlib.sha256(), 0
                with archive.open(info) as src, target.open("xb") as dst:
                    for block in iter(lambda: src.read(1024 * 1024), b""):
                        length += len(block)
                        if length > row["size"]:
                            raise ValueError("Payload exceeds manifest size")
                        h.update(block)
                        dst.write(block)
                if length != row["size"] or h.hexdigest() != row["sha256"]:
                    raise ValueError("Payload SHA-256 mismatch: " + name)
            if not (stage / "index.html").is_file() or json.loads((stage / "version.json").read_text("utf-8")) != manifest["targetVersion"]:
                raise ValueError("Final website/version mismatch")
            if {p.relative_to(stage).as_posix() for p in stage.rglob("*") if p.is_file()} != set(final):
                raise ValueError("Final filesystem inventory mismatch")
            # Validate bytes independently after writing, before making the site visible.
            for name, row in final.items():
                if digest_file(stage.joinpath(*name.split("/"))) != row["sha256"]:
                    raise ValueError("Final file read-back mismatch: " + name)
            os.rename(stage, output)
            stage = None
            return {"verified": True, "output": str(output), "files": len(final), "changed": len(changed), "deleted": len(deleted), "targetVersion": manifest["targetVersion"]}
    finally:
        # Only this invocation's mkdtemp directory can be removed after an error.
        if stage is not None and stage.parent == output.parent and stage.name.startswith(output.name + ".staging-"):
            shutil.rmtree(stage)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build_parser = commands.add_parser("build")
    for flag in ("base-zip", "target-zip", "output", "base-tag"):
        build_parser.add_argument("--" + flag, required=True)
    apply_parser = commands.add_parser("apply")
    for flag in ("base-zip", "patch-zip", "output-directory"):
        apply_parser.add_argument("--" + flag, required=True)
    args = vars(parser.parse_args())
    command = args.pop("command")
    print(json.dumps((build if command == "build" else apply)(**args), ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
