/**
 * Extracts the roster listed under a pasted Reclub session's "Participants"
 * heading (a numbered list, e.g. "1. Renan"). Reclub's schedule text also
 * lists a smaller, differently-labeled group above "Participants" (session
 * organizers/instructors) — only the numbered lines after "Participants" are
 * treated as the roster to import. Only the first word of each listed name
 * is kept (e.g. "1. Renan Villamor" -> "Renan").
 */
export function parseReclubParticipants(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const startIndex = lines.findIndex((line) =>
    /^\s*participants\b/i.test(line),
  );
  if (startIndex === -1) return [];

  const names: string[] = [];
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const match = line.match(/^\s*\d+\.\s*(.+?)\s*$/);
    if (!match) break;
    const name = match[1].trim().split(/\s+/)[0];
    if (name) names.push(name);
  }
  return names;
}
