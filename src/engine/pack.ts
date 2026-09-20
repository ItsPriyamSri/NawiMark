/**
 * One pack. Every numeric R-76 sheet this product can defend is marked here.
 * EMC / construction / software checklist stay forms only — never auto-PASS.
 */
export const PACK_ID = "R-76 pack v1";

export const PACK_MARKS = [
  "WEIGHING",
  "ECCENTRICITY",
  "REPEATABILITY",
  "TARE",
  "DISCRIMINATION",
  "SENSITIVITY",
  "ZERO_RETURN",
  "CREEP",
  "STABILITY",
  "TILT",
  "WARMUP",
  "VOLTAGE",
  "TEMP_NOLOAD",
  "DAMP_HEAT",
  "SPAN_STABILITY",
  "ENDURANCE",
  "ROLLING_ECC",
] as const;

export type PackMark = (typeof PACK_MARKS)[number];

/** Eyes-only. A green tick here is how this PS dies. */
export const NEVER_MARK = ["EMC", "CONSTRUCTION", "CHECKLIST"] as const;

export const TEMP_MIN = -10;
export const TEMP_MAX = 40;
export const RH_MIN = 0;
export const RH_MAX = 85;

export const MPE_BAND = "initial / type evaluation (Table 6)";
export const MPE_BAND_INSPECTION = "in-service / shop verification (2× Table 6)";
