const trailingNumber = (name: string): number | null => {
  const match = name.trim().match(/(\d+)$/);
  return match ? Number(match[1]) : null;
};

/**
 * Default name for a new court: one past the number on the last court
 * ("Court 2" → "Court 3"). If the last court has no number (renamed, e.g.
 * "Center Court"), counts on from the highest-numbered court, else from the
 * court count. Skips any number already in use so it never suggests a duplicate.
 */
export function nextCourtName(existingNames: string[]): string {
  const last = existingNames[existingNames.length - 1];
  const numbers = existingNames
    .map(trailingNumber)
    .filter((n): n is number => n !== null);
  let next =
    (last !== undefined ? trailingNumber(last) : null) ??
    (numbers.length > 0 ? Math.max(...numbers) : existingNames.length);
  next += 1;

  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  while (taken.has(`court ${next}`)) next += 1;
  return `Court ${next}`;
}
