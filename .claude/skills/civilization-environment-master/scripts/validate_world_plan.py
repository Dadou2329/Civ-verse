#!/usr/bin/env python3
"""Validate and compare Civilizationverse urban world plans (read-only; stdlib only)."""
import argparse
import json
from collections import deque
from pathlib import Path

REQUIRED_FINGERPRINT = (
    "macroform", "city_pattern", "district_relations", "elevation_logic",
    "landmark_type", "movement_signature", "water_role", "first_impression",
)

def load(path):
    with path.open("r", encoding="utf-8") as f:
        obj = json.load(f)
    if not isinstance(obj, dict):
        raise ValueError("Le plan doit être un objet JSON.")
    return obj

def validate(plan):
    errors, warnings = [], []
    for name in ("civilization_id", "display_name_fr", "concept_fr", "map_identity_sentence_fr"):
        if not isinstance(plan.get(name), str) or not plan[name].strip():
            errors.append(f"Champ texte obligatoire : {name}")
    for section, fields in {
        "geography": ("macroform", "verticality", "water_logic", "terrain_features"),
        "urban_plan": ("street_pattern", "district_arrangement", "districts", "connections"),
        "design_language": ("terrain_materials", "building_materials", "architectural_motifs"),
        "navigation_and_gameplay": ("starting_location", "primary_route", "setpieces", "vista_points"),
        "anti_repetition": ("compared_against", "differentiators", "forbidden_shortcuts"),
    }.items():
        obj = plan.get(section)
        if not isinstance(obj, dict):
            errors.append(f"Section obligatoire : {section}")
            continue
        for key in fields:
            if key not in obj or obj[key] in ("", None, []):
                if section == "anti_repetition" and key == "compared_against":
                    warnings.append("Aucune civilisation existante renseignée dans compared_against : documenter l'audit manuel.")
                else:
                    errors.append(f"Champ obligatoire manquant/vide : {section}.{key}")
    fp = plan.get("fingerprint")
    if not isinstance(fp, dict):
        errors.append("Section obligatoire : fingerprint")
    else:
        for field in REQUIRED_FINGERPRINT:
            if not isinstance(fp.get(field), str) or not fp[field].strip():
                errors.append(f"Signature manquante/vide : fingerprint.{field}")
    urban = plan.get("urban_plan")
    nav = plan.get("navigation_and_gameplay")
    if isinstance(urban, dict):
        districts = urban.get("districts", [])
        if not isinstance(districts, list) or len(districts) < 3:
            errors.append("urban_plan.districts : au moins trois quartiers fonctionnels.")
            districts = []
        ids = []
        for i, d in enumerate(districts):
            if not isinstance(d, dict):
                errors.append(f"district[{i}] doit être un objet.")
                continue
            for key in ("id", "function", "spatial_character", "landmark"):
                if not isinstance(d.get(key), str) or not d[key].strip():
                    errors.append(f"district[{i}].{key} manquant.")
            if isinstance(d.get("id"), str):
                ids.append(d["id"])
        if len(ids) != len(set(ids)):
            errors.append("IDs de quartiers dupliqués.")
        links = urban.get("connections", [])
        if not isinstance(links, list):
            errors.append("urban_plan.connections doit être une liste de paires.")
            links = []
        graph = {x: set() for x in ids}
        for pair in links:
            if not isinstance(pair, list) or len(pair) != 2 or any(x not in graph for x in pair):
                errors.append(f"Lien invalide : {pair!r}")
            else:
                graph[pair[0]].add(pair[1])
                graph[pair[1]].add(pair[0])
        if ids:
            seen = {ids[0]}
            queue = deque([ids[0]])
            while queue:
                node = queue.popleft()
                for neighbor in graph[node] - seen:
                    seen.add(neighbor)
                    queue.append(neighbor)
            if len(seen) < len(ids):
                errors.append(f"Graphe de quartiers déconnecté : {sorted(set(ids) - seen)}")
        if isinstance(nav, dict):
            start = nav.get("starting_location")
            if start not in ids:
                errors.append("Le lieu de départ ne correspond à aucun quartier.")
            route = nav.get("primary_route")
            if not isinstance(route, list) or len(route) < 3 or any(x not in ids for x in route):
                errors.append("primary_route : liste d'au moins 3 IDs de quartiers existants.")
            elif start != route[0]:
                warnings.append("primary_route ne commence pas dans starting_location.")
            else:
                for a, b in zip(route, route[1:]):
                    if a != b and b not in graph[a]:
                        errors.append(f"Trajet principal non relié : {a} -> {b}")
    if isinstance(plan.get("anti_repetition"), dict):
        if len(plan["anti_repetition"].get("differentiators", [])) < 4:
            warnings.append("Décrire au moins 4 différences concrètes avec les cartes existantes.")
    return errors, warnings

def similarity(a, b):
    fpa, fpb = a.get("fingerprint", {}), b.get("fingerprint", {})
    return [key for key in REQUIRED_FINGERPRINT if str(fpa.get(key, "")).strip().lower() and str(fpa.get(key, "")).strip().lower() == str(fpb.get(key, "")).strip().lower()]

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("plan", type=Path)
    ap.add_argument("--compare-dir", type=Path, help="Dossier de plans JSON existants à comparer")
    args = ap.parse_args()
    try:
        target = load(args.plan)
    except (OSError, ValueError, json.JSONDecodeError) as e:
        print(f"ERREUR de lecture : {e}")
        return 2
    errors, warnings = validate(target)
    print(f"AUDIT : {args.plan}")
    if args.compare_dir:
        for path in sorted(args.compare_dir.glob("*.json")):
            if path.resolve() == args.plan.resolve():
                continue
            try:
                other = load(path)
                overlap = similarity(target, other)
                print(f" - vs {path.name}: {len(overlap)}/8 empreintes identiques ({', '.join(overlap) or 'aucune'})")
                if len(overlap) >= 3:
                    warnings.append(f"Ressemblance structurelle significative avec {path.name} : réexaminer la carte en vue de dessus et FPS.")
            except (OSError, ValueError, json.JSONDecodeError) as e:
                warnings.append(f"Comparaison ignorée ({path.name}): {e}")
    for issue in errors:
        print(f"ERREUR: {issue}")
    for issue in warnings:
        print(f"ATTENTION: {issue}")
    if errors:
        print(f"ÉCHEC : {len(errors)} erreur(s), {len(warnings)} avertissement(s).")
        return 1
    print(f"OK structurel : {len(warnings)} avertissement(s). Ce résultat ne certifie PAS le design ni l'intégration 3D.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
