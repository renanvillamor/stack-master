const LATEST_RELEASE_API_URL =
  "https://api.github.com/repos/renanvillamor/stack-master/releases/latest";

/** Tag of the newest GitHub release with the leading "v" stripped (e.g. "1.2"). */
export async function fetchLatestReleaseVersion(): Promise<string> {
  const res = await fetch(LATEST_RELEASE_API_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const release: { tag_name: string } = await res.json();
  return release.tag_name.replace(/^v/i, "");
}

/**
 * Numeric dotted-version compare, padding missing parts with 0 so a "v1.1" tag
 * equals app version "1.1.0".
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = candidate.split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}
