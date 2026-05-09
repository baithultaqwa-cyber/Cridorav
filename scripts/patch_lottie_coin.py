"""Patch wired-flat coin Lottie: gradient-gold-text palette + strip AE expressions."""
import json
import sys

# Match .gradient-gold-text / .gradient-gold-text-hero (index.css): #ffbc00, #8b6f00, #f1b202
PRIMARY = [255 / 255, 188 / 255, 0 / 255]
PRIMARY_4 = PRIMARY + [1]
SECONDARY = [139 / 255, 111 / 255, 0 / 255]


def _rgb01(k):
    if not isinstance(k, (list, tuple)) or len(k) < 3:
        return None
    try:
        return float(k[0]), float(k[1]), float(k[2])
    except (TypeError, ValueError):
        return None


def is_wiredflat_orange_gold(k):
    t = _rgb01(k)
    if t is None or len(k) not in (3, 4):
        return False
    r, g, b = t
    return r > 0.99 and 0.74 <= g <= 0.81 and 0.18 <= b <= 0.26


def is_prev_primary_c9(k):
    """Earlier patch used UI gold #c9a84c."""
    t = _rgb01(k)
    if t is None or len(k) not in (3, 4):
        return False
    r, g, b = t
    return (
        abs(r - 201 / 255) < 0.03
        and abs(g - 168 / 255) < 0.03
        and abs(b - 76 / 255) < 0.03
    )


def is_prev_primary_e8(k):
    """Patch used logo face #e8c040."""
    t = _rgb01(k)
    if t is None or len(k) not in (3, 4):
        return False
    r, g, b = t
    return (
        abs(r - 232 / 255) < 0.03
        and abs(g - 192 / 255) < 0.03
        and abs(b - 64 / 255) < 0.03
    )


def is_prev_primary_ffbc(k):
    """Re-run after #ffbc00 patch."""
    t = _rgb01(k)
    if t is None or len(k) not in (3, 4):
        return False
    r, g, b = t
    return (
        abs(r - 255 / 255) < 0.02
        and abs(g - 188 / 255) < 0.03
        and abs(b - 0 / 255) < 0.02
    )


def is_secondary_brown(k):
    t = _rgb01(k)
    if t is None or len(k) != 3:
        return False
    r, g, b = t
    return 0.64 <= r <= 0.72 and 0.38 <= g <= 0.43 and 0.19 <= b <= 0.23


def is_prev_secondary_edge(k):
    t = _rgb01(k)
    if t is None or len(k) != 3:
        return False
    r, g, b = t
    return (
        abs(r - 107 / 255) < 0.03
        and abs(g - 82 / 255) < 0.03
        and abs(b - 20 / 255) < 0.03
    )


def is_prev_secondary_8b(k):
    """After #8b6f00 patch or AE secondary."""
    t = _rgb01(k)
    if t is None or len(k) != 3:
        return False
    r, g, b = t
    return (
        abs(r - 139 / 255) < 0.03
        and abs(g - 111 / 255) < 0.03
        and abs(b - 0 / 255) < 0.03
    )


def is_prev_secondary_9a(k):
    """Patch used #9a7420."""
    t = _rgb01(k)
    if t is None or len(k) != 3:
        return False
    r, g, b = t
    return (
        abs(r - 154 / 255) < 0.03
        and abs(g - 116 / 255) < 0.03
        and abs(b - 32 / 255) < 0.03
    )


def should_replace_primary(k):
    return (
        is_wiredflat_orange_gold(k)
        or is_prev_primary_c9(k)
        or is_prev_primary_e8(k)
        or is_prev_primary_ffbc(k)
    )


def should_replace_secondary(k):
    return (
        is_secondary_brown(k)
        or is_prev_secondary_edge(k)
        or is_prev_secondary_8b(k)
        or is_prev_secondary_9a(k)
    )


def patch(obj):
    if isinstance(obj, dict):
        if "x" in obj and isinstance(obj.get("x"), str) and "$bm_rt" in obj["x"]:
            del obj["x"]
        k = obj.get("k")
        if should_replace_primary(k):
            obj["k"] = PRIMARY_4[: len(k)] if len(k) == 4 else PRIMARY[: len(k)]
        elif should_replace_secondary(k):
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
