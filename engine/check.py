#!/usr/bin/env python3
"""Held-out R-76 pass/fail. Numbers are not the comment examples in r76.py."""
from decimal import Decimal

from r76 import (
    eccentricity_result,
    indication_error,
    mpe_initial,
    repeatability_result,
    validate_instrument,
)

# Class III, Max=30 kg, e=10 g → n=3000. Masses in grams.
E = Decimal(10)
MAX = Decimal(30000)
CLASS = "III"


def _mpe_bands():
    # 3 kg = 300e → ±0.5e; 15 kg = 1500e → ±1.0e
    assert mpe_initial(CLASS, E, Decimal(3000)) == Decimal("5")
    assert mpe_initial(CLASS, E, Decimal(15000)) == Decimal("10")
    assert indication_error(Decimal(3004), Decimal(3000)) == Decimal(4)


def _rep_pass():
    # 5 kg = 500e → |MPE|=0.5e=5 g. Spread 5 g, each |error|≤5.
    r = repeatability_result(Decimal(5000), [4998, 5000, 5001, 5002, 5003], CLASS, E)
    assert r["mpe"] == Decimal(5) and r["spread"] == Decimal(5)
    assert r["spread_ok"] and r["errors_ok"] and r["passed"]


def _rep_fail_near_miss():
    # Spread 6 g just over 5 g MPE; each |error| still ≤5 (3.6.1 only).
    r = repeatability_result(Decimal(5000), [4997, 5000, 5001, 5002, 5003], CLASS, E)
    assert r["mpe"] == Decimal(5) and r["spread"] == Decimal(6)
    assert r["errors_ok"] and not r["spread_ok"] and not r["passed"]


def _ecc_pass():
    # Max/3 = 10 kg = 1000e → |MPE|=1.0e=10 g. Four corners.
    true = Decimal(10000)
    r = eccentricity_result(true, {"A": 10008, "B": 9993, "C": 10010, "D": 9990}, CLASS, E)
    assert r["mpe"] == Decimal(10) and r["passed"]
    assert abs(r["errors"]["C"]) == Decimal(10)


def _ecc_fail_near_miss():
    # One corner 0.001 g over MPE (10.001 vs 10). Dummy form-dump would miss this.
    true = Decimal(10000)
    r = eccentricity_result(
        true,
        {"A": 10008, "B": 9993, "C": Decimal("10010.001"), "D": 9990},
        CLASS,
        E,
    )
    assert r["mpe"] == Decimal(10)
    assert r["errors"]["C"] == Decimal("10.001")
    assert not r["passed"]


def _illegal_n():
    # Class III n=30000 (Max=30 kg, e=1 g) > 10000.
    try:
        validate_instrument(CLASS, MAX, Decimal(1))
    except ValueError as err:
        assert "cannot-compute" in str(err)
        return
    raise AssertionError("illegal class/e/Max was accepted")


def main():
    cases = [
        ("mpe_bands_3kg_15kg", _mpe_bands),
        ("repeatability_pass", _rep_pass),
        ("repeatability_fail_near_miss", _rep_fail_near_miss),
        ("eccentricity_pass", _ecc_pass),
        ("eccentricity_fail_near_miss", _ecc_fail_near_miss),
        ("validate_rejects_illegal_n", _illegal_n),
    ]
    failed = []
    for name, fn in cases:
        try:
            fn()
        except Exception as err:
            failed.append(f"{name} ({err})")
    n, k = len(cases), len(cases) - len(failed)
    if failed:
        print(f"KILL {k}/{n} held-out correct; failed: {'; '.join(failed)}")
        return 1
    # sanity: legal instrument used above is Table-3-ok
    assert validate_instrument(CLASS, MAX, E) == 3000
    print(f"ALIVE {k}/{n} held-out correct")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
