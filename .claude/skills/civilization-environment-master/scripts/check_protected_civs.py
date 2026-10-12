#!/usr/bin/env python3
"""Read-only Git audit: flag changes to civilization packs outside the authorized new pack.

This is a warning tool, not an enforcement mechanism. Stdlib only.
"""
import argparse
import subprocess
import sys
from pathlib import PurePosixPath


def git(*args):
    return subprocess.check_output(["git", *args], stderr=subprocess.PIPE)


def posix_path(s):
    s = s.replace("\\", "/").strip("/")
    if not s or s == "." or ".." in PurePosixPath(s).parts:
        raise ValueError("Chemin vide ou non valide : " + repr(s))
    return s


def changed_paths():
    """Parse git porcelain -z, including rename/copy original paths."""
    result = git("status", "--porcelain=v1", "-z", "--untracked-files=all")
    chunks = result.split(b"\0")
    out = []
    i = 0
    while i < len(chunks):
        row = chunks[i]
        i += 1
        if not row:
            continue
        if len(row) < 4 or row[2:3] != b" ":
            raise ValueError("Format Git status inattendu")
        status = row[:2].decode("utf-8", "replace")
        out.append(row[3:].decode("utf-8", "surrogateescape"))
        if "R" in status or "C" in status:
            if i < len(chunks) and chunks[i]:
                out.append(chunks[i].decode("utf-8", "surrogateescape"))
                i += 1
    return out


def is_under(p, directory):
    return p == directory or p.startswith(directory + "/")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--civilizations-dir", required=True,
                        help="Dossier des packs relativement à la racine Git, ex: src/civilizations")
    parser.add_argument("--target", required=True,
                        help="Identifiant du pack NOUVEAU autorisé, ex: sound-civilization")
    args = parser.parse_args()
    try:
        root = git("rev-parse", "--show-toplevel").decode("utf-8", "replace").strip()
        folder = posix_path(args.civilizations_dir)
        target = posix_path(args.target)
        if "/" in target:
            parser.error("--target doit être un nom de dossier, pas un chemin")
        changed = changed_paths()
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError) as exc:
        print("AUDIT IMPOSSIBLE :", exc, file=sys.stderr)
        return 2
    allowed = folder + "/" + target
    checked = [p for p in changed if is_under(p, folder)]
    violations = [p for p in checked if not is_under(p, allowed)]
    print("Racine Git :", root)
    print("Packs surveillés :", folder)
    print("Nouveau pack autorisé :", allowed)
    if violations:
        print("ALERTE — fichiers touchés dans d'autres civilisations :")
        for p in violations:
            print("  -", p)
        print("Cela peut provenir de modifications préexistantes : inspecter le diff avant de continuer.")
        return 1
    print("OK — aucune modification détectée dans les autres packs (selon git status).")
    print("ATTENTION : contrôler séparément les assets et fichiers partagés hors de", folder)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
