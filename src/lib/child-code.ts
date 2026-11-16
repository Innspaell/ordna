import { createHash, randomInt } from "node:crypto";

/** Uten 0/O, 1/I/L, så koden er lett å skrive av fra en annen skjerm. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return formatCode(s);
}

export function formatCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

/** Fra det barnet skriver til 8 tegn, eller null hvis det ikke kan være en kode. */
export function normalizeCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, "");
  if (s.length !== 8) return null;
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null;
  return s;
}

/** Bare hashen lagres i databasen. */
export function hashCode(normalized: string): string {
  return createHash("sha256").update(`ordna-barnekode:${normalized}`).digest("hex");
}
