import { differenceInHours, differenceInMinutes } from "date-fns";

/** Formats an ISO timestamp as a short relative time, e.g. "5m ago", "2h ago". */
export function formatLastPlayed(iso: string | null): string {
  if (!iso) return "Never";
  try {
    const now = new Date();
    const date = new Date(iso);
    const minutes = differenceInMinutes(now, date);
    if (minutes <= 0) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = differenceInHours(now, date);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return "Never";
  }
}
