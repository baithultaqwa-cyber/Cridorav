"""Patch wired-flat coin Lottie: Cridora palette + strip AE expressions for web."""
import json
import sys

PRIMARY = [201 / 255, 168 / 255, 76 / 255]
PRIMARY_4 = PRIMARY + [1]
SECONDARY = [107 / 255, 82 / 255, 20 / 255]


def _rgb01(k):
    if not isinstance(k, (list, tuple)) or len(k) < 3:
        return None
    try:
        return float(k[0]), float(k[1]), float(k[2])
    except (TypeError, ValueError):
        return None


def is_primary_gold(k):
    t = _rgb01(k)
    if t is None or len(k) not in (3, 4):
        return False
    r, g, b = t
    return r > 0.99 and 0.74 <= g <= 0.81 and 0.18 <= b <= 0.26


def is_secondary_old(k):
    t = _rgb01(k)
    if t is None or len(k) != 3:
        return False
    r, g, b = t
    return 0.64 <= r <= 0.72 and 0.38 <= g <= 0.43 and 0.19 <= b <= 0.23


def patch(obj):
    if isinstance(obj, dict):
        if "x" in obj and isinstance(obj.get("x"), str) and "$bm_rt" in obj["x"]:
            del obj["x"]
        k = obj.get("k")
        if is_primary_gold(k):
            obj["k"] = PRIMARY_4[: len(k)] if len(k) == 4 else PRIMARY[: len(k)]
        elif is_secondary_old(k):
            obj["k"] = SECONDARY
        for v in obj.values():
            patch(v)
    elif isinstance(obj, list):
        for v in obj:
            patch(v)


def main():
    if len(sys.argv) < 2:
        print("usage: patch_lottie_coin.py <input.json>", file=sys.stderr)
        sys.exit(1)
    path = sys.argv[1]
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    try:
        ctrl = d["layers"][0]
        if ctrl.get("nm") == "control" and "ef" in ctrl:
            for eff in ctrl["ef"]:
                nm = eff.get("nm")
                for prop in eff.get("ef") or []:
                    if prop.get("nm") != "Color" or "v" not in prop:
                        continue
                    vk = prop["v"].get("k")
                    if nm == "primary" and isinstance(vk, list) and len(vk) == 3:
                        prop["v"]["k"] = PRIMARY[:]
                    elif nm == "secondary" and isinstance(vk, list) and len(vk) == 3:
                        prop["v"]["k"] = SECONDARY[:]
    except (IndexError, KeyError):
        pass
    patch(d)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
    print("OK", path)


if __name__ == "__main__":
    main()
