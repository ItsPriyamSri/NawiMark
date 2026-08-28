"""OIML R 76-1 (2006) core pass/fail: Table 6 MPE, 3.6.1, 3.6.2. Stdlib only.

ponytail: skip digital rounding-error elimination (3.5.3.2); d=e assumed.
Errors are I − L, not E = I + 0.5e − ΔL − L. All masses in one unit (caller).
Type evaluation uses Table 6 initial MPE, not 3.5.2 in-service (2×).
"""
from decimal import Decimal

def _d(x):
    if isinstance(x, float):
        raise TypeError("float is inexact; pass Decimal, int, or str")
    return x if isinstance(x, Decimal) else Decimal(x)


# 3.5.1 Table 6 initial verification. (m_max inclusive in e, |MPE| in e).
# Class I last band unbounded. Ex (not held-out): II, e=1 g, 4000 g → 0.5e.
_TABLE6 = {
    "I": ((50000, Decimal("0.5")), (200000, Decimal("1.0")), (None, Decimal("1.5"))),
    "II": ((5000, Decimal("0.5")), (20000, Decimal("1.0")), (100000, Decimal("1.5"))),
    "III": ((500, Decimal("0.5")), (2000, Decimal("1.0")), (10000, Decimal("1.5"))),
    "IIII": ((50, Decimal("0.5")), (200, Decimal("1.0")), (1000, Decimal("1.5"))),
}

# Table 3 n=Max/e, simplified n-only (not e-split sub-rows). I: n≥50000 (tiny-d omitted).
_N_BOUNDS = {
    "I": (50000, None),
    "II": (100, 100000),
    "III": (100, 10000),
    "IIII": (100, 1000),
}


def mpe_initial(class_, e, load):
    """Absolute MPE in mass units. R 76-1 3.5.1 Table 6 (initial / type eval)."""
    e, load = _d(e), _d(load)
    bands = _TABLE6.get(class_)
    if bands is None or e <= 0 or load < 0:
        raise ValueError("cannot-compute: bad class/e/load")
    m_e = load / e
    for cap, mpe_e in bands:
        if cap is None or m_e <= cap:
            return mpe_e * e
    raise ValueError("cannot-compute: load above Table 6 for class")


def indication_error(indicated, true_load):
    """I − L. ponytail: d=e, no 3.5.3.2 change-point correction."""
    return _d(indicated) - _d(true_load)


def repeatability_result(true_load, indications, class_, e):
    """3.6.1: max−min of indications vs |MPE|. 3.6: each |I−L| vs MPE."""
    inds = [_d(i) for i in indications]
    mpe = mpe_initial(class_, e, true_load)
    spread = max(inds) - min(inds)
    errors = [indication_error(i, true_load) for i in inds]
    spread_ok = spread <= mpe
    errors_ok = all(abs(err) <= mpe for err in errors)
    return {
        "passed": spread_ok and errors_ok,
        "spread": spread,
        "mpe": mpe,
        "spread_ok": spread_ok,
        "errors_ok": errors_ok,
        "errors": errors,
    }


def eccentricity_result(true_load, indications_by_position, class_, e):
    """3.6.2: each position |I−L| vs MPE. 3.6.2.1: 4-support, load ≈ Max/3, tare=0."""
    mpe = mpe_initial(class_, e, true_load)
    errors = {p: indication_error(i, true_load) for p, i in indications_by_position.items()}
    return {
        "passed": all(abs(err) <= mpe for err in errors.values()),
        "mpe": mpe,
        "errors": errors,
    }


def validate_instrument(class_, Max, e):
    """Return n=Max/e. Raise cannot-compute if Table 3 n-bounds fail (simplified)."""
    Max, e = _d(Max), _d(e)
    if class_ not in _N_BOUNDS or e <= 0 or Max <= 0:
        raise ValueError("cannot-compute: bad class/Max/e")
    n = Max / e
    if n != n.to_integral_value():
        raise ValueError("cannot-compute: n=Max/e is not an integer")
    n = int(n)
    lo, hi = _N_BOUNDS[class_]
    if n < lo or (hi is not None and n > hi):
        span = f"{lo}–{hi}" if hi is not None else f"≥{lo}"
        raise ValueError(f"cannot-compute: class {class_} n={n} outside {span} (R-76 Table 3)")
    return n
