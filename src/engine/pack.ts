/**
 * One pack. Every numeric R-76 sheet this product can defend is marked here.
 * EMC / construction / software checklist stay forms only — never auto-PASS.
 * v2: rounding elimination (ΔL), E0 correction, creep 0.5e/0.2e + 4 h, two
 * repeatability series, and R 76-1:2006 applicability. v1 marks are not re-used.
 */
export const PACK_ID = "R-76 pack v2";

export const PACK_MARKS = [
  "WEIGHING",
  "ZERO_SETTING",
  "ECCENTRICITY",
  "REPEATABILITY",
  "TARE",
  "TARE_SETTING",
  "DISCRIMINATION",
  "SENSITIVITY",
  "ZERO_RETURN",
  "CREEP",
  "STABILITY",
  "TILT",
  "WARMUP",
  "VOLTAGE",
  "STATIC_TEMP",
  "TEMP_NOLOAD",
  "DAMP_HEAT",
  "SPAN_STABILITY",
  "ENDURANCE",
  "ROLLING_ECC",
] as const;

export type PackMark = (typeof PACK_MARKS)[number];

/** Eyes-only. A green tick here is how this PS dies. */
export const NEVER_MARK = ["EMC", "CONSTRUCTION", "CHECKLIST"] as const;

/** Tester may declare these not applicable, with a reason the reviewer sees. */
export const TESTER_MAY_WAIVE = ["ROLLING_ECC", "TILT", "TARE", "TARE_SETTING"] as const;

/**
 * Applicability from R 76-1:2006 scope notes. The pack covers digital,
 * electronic, single-range instruments (d = e). null = the test applies.
 */
export function notApplicableReason(key: string, class_: string, maxG: string, eG: string): string | null {
  switch (key) {
    case "DISCRIMINATION":
      return Number(eG) < 0.005 ? "A.4.8.2: the digital discrimination test applies only to d ≥ 5 mg." : null;
    case "SENSITIVITY":
      return "6.1 / A.4.9 apply to non-self-indicating instruments; this pack covers digital self-indicating instruments.";
    case "CREEP":
    case "ZERO_RETURN":
      return class_ === "I" ? "3.9.4 applies to classes II, III and IIII only." : null;
    case "TILT":
      return class_ === "I" ? "3.9.1.2: class I instruments are not tilt-tested." : null;
    case "ENDURANCE":
      if (class_ === "I") return "A.6: endurance applies to classes II, III and IIII only.";
      return Number(maxG) > 100000 ? "A.6: endurance applies only to instruments with Max ≤ 100 kg." : null;
    case "SPAN_STABILITY":
      return class_ === "I" ? "B.4: span stability is not applicable to class I." : null;
    case "DAMP_HEAT":
      return class_ === "I" || (class_ === "II" && Number(eG) < 1)
        ? "B.2 / 5.3.2: damp heat is not applicable to class I, or class II with e < 1 g."
        : null;
    default:
      return null;
  }
}

export const PROCEDURE_LABELS: Record<string, string> = {
  WEIGHING: "Weighing performance",
  ZERO_SETTING: "Accuracy of zero-setting",
  ECCENTRICITY: "Eccentricity (4-corner)",
  REPEATABILITY: "Repeatability",
  TARE: "Tare weighing",
  TARE_SETTING: "Accuracy of tare setting",
  DISCRIMINATION: "Discrimination (digital)",
  SENSITIVITY: "Sensitivity (non-self-indicating)",
  ZERO_RETURN: "Zero return",
  CREEP: "Creep",
  STABILITY: "Stability of equilibrium",
  TILT: "Tilt",
  WARMUP: "Warm-up time",
  VOLTAGE: "Voltage variations",
  STATIC_TEMP: "Static temperatures",
  TEMP_NOLOAD: "Temperature effect on no-load",
  DAMP_HEAT: "Damp heat, steady state",
  SPAN_STABILITY: "Span stability",
  ENDURANCE: "Endurance",
  ROLLING_ECC: "Rolling-load eccentricity",
  EMC: "Electrical disturbances (EMC)",
  CONSTRUCTION: "Construction examination",
  CHECKLIST: "Software checklist",
};

export const TEMP_MIN = -10;
export const TEMP_MAX = 40;
export const RH_MIN = 0;
export const RH_MAX = 85;

/**
 * Pack tolerances for "about ½ Max" and "close to Max" (A.4.10, A.4.11, A.5.2, B.4).
 * The standard gives no number; these are this pack's reading of the words.
 */
export const ABOUT_HALF_MAX: [number, number] = [0.4, 0.6];
export const CLOSE_TO_MAX = 0.9;

export const MPE_BAND = "initial / type evaluation (Table 6)";
export const MPE_BAND_INSPECTION = "in-service / shop verification (2× Table 6)";
