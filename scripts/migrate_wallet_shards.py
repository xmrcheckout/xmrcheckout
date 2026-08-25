#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import shutil
import sys
import uuid


def shard_index(wallet_name: str, shard_count: int) -> int:
    digest = hashlib.sha256(wallet_name.encode("utf-8")).hexdigest()
    return int(digest, 16) % shard_count


def file_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def wallet_groups(source: Path) -> list[tuple[str, list[Path]]]:
    keys_files = sorted(source.glob("user-*.keys"))
    groups: list[tuple[str, list[Path]]] = []
    claimed: set[Path] = set()
    for keys_path in keys_files:
        if not keys_path.is_file() or keys_path.stat().st_size == 0:
            raise ValueError("A wallet keys file is missing or empty; migration refused")
        wallet_name = keys_path.name.removesuffix(".keys")
        companions = sorted(
            path
            for path in source.iterdir()
            if path.is_file()
            and (path.name == wallet_name or path.name.startswith(f"{wallet_name}."))
        )
        groups.append((wallet_name, companions))
        claimed.update(companions)

    unclaimed = [
        path
        for path in source.iterdir()
        if path.is_file() and path.name.startswith("user-") and path not in claimed
    ]
    if unclaimed:
        raise ValueError("Unmatched wallet files exist; migration refused")
    if not groups:
        raise ValueError("No wallet keys files found; migration refused")
    return groups


def migrate(source: Path, target_root: Path, prefix: str, shard_count: int) -> dict[str, int]:
    groups = wallet_groups(source)
    final_targets = [target_root / f"{prefix}-{index + 1}" for index in range(shard_count)]
    if any(path.exists() for path in final_targets):
        raise ValueError("A target shard directory already exists; migration refused")

    staging_root = target_root / f".{prefix}-migration-{uuid.uuid4().hex}"
    staging_root.mkdir(mode=0o700, parents=True)
    copied_files = 0
    zero_caches = 0
    try:
        staging_targets = []
        for index in range(shard_count):
            target = staging_root / f"{prefix}-{index + 1}"
            target.mkdir(mode=0o700)
            staging_targets.append(target)

        for wallet_name, files in groups:
            target = staging_targets[shard_index(wallet_name, shard_count)]
            for source_file in files:
                destination = target / source_file.name
                shutil.copy2(source_file, destination)
                destination.chmod(0o600)
                if file_digest(source_file) != file_digest(destination):
                    raise ValueError("Wallet file checksum validation failed")
                copied_files += 1
                if source_file.name == wallet_name and source_file.stat().st_size == 0:
                    zero_caches += 1

        for staging_target, final_target in zip(staging_targets, final_targets, strict=True):
            os.replace(staging_target, final_target)
        staging_root.rmdir()
    except Exception:
        shutil.rmtree(staging_root, ignore_errors=True)
        raise

    return {
        "wallets": len(groups),
        "files": copied_files,
        "zero_caches": zero_caches,
        "shards": shard_count,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy a shared view-only wallet directory into deterministic shards."
    )
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--target-root", type=Path, required=True)
    parser.add_argument("--prefix", default="reconciler")
    parser.add_argument("--shards", type=int, default=3)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Create shard directories. Without this flag only validation and counts run.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.shards < 1:
            raise ValueError("Shard count must be positive")
        groups = wallet_groups(args.source)
        files = sum(len(group_files) for _, group_files in groups)
        zero_caches = sum(
            1
            for wallet_name, group_files in groups
            for path in group_files
            if path.name == wallet_name and path.stat().st_size == 0
        )
        print(
            f"validated wallets={len(groups)} files={files} "
            f"zero_caches={zero_caches} shards={args.shards}"
        )
        if not args.apply:
            print("dry-run only; pass --apply to create shard directories")
            return 0
        result = migrate(args.source, args.target_root, args.prefix, args.shards)
        print(
            "migration complete "
            + " ".join(f"{key}={value}" for key, value in result.items())
        )
        return 0
    except (OSError, ValueError) as exc:
        print(f"migration failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
