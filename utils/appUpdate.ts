import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";

/**
 * Direct APK download: GitHub redirects `releases/latest/download/<asset>` to that
 * asset on the newest release, so the QR never goes stale — but every release
 * must attach the APK under exactly this file name.
 */
export const APP_DOWNLOAD_URL =
  "https://github.com/renanvillamor/stack-master/releases/latest/download/StackMaster.apk";

const LATEST_RELEASE_PAGE_URL =
  "https://github.com/renanvillamor/stack-master/releases/latest";
const LATEST_RELEASE_API_URL =
  "https://api.github.com/repos/renanvillamor/stack-master/releases/latest";

const stripV = (tag: string) => tag.replace(/^v/i, "");

/**
 * The releases/latest web page redirects to /releases/tag/<tag>, so the tag
 * can be read off the final URL without downloading anything. Unlike the
 * API below, it isn't capped at 60 anonymous requests per hour per IP, and
 * that cap is shared by everyone behind the same public address (mobile
 * data, venue wifi), so the API alone kept failing for users.
 */
async function fetchTagFromRedirect(): Promise<string> {
  const res = await fetch(LATEST_RELEASE_PAGE_URL, { method: "HEAD" });
  const match = res.url.match(/\/releases\/tag\/([^/?#]+)/);
  if (!res.ok || !match) throw new Error(`No release tag in ${res.url}`);
  return stripV(decodeURIComponent(match[1]));
}

async function fetchTagFromApi(): Promise<string> {
  const res = await fetch(LATEST_RELEASE_API_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const release: { tag_name: string } = await res.json();
  return stripV(release.tag_name);
}

/**
 * Tag of the newest GitHub release with the leading "v" stripped (e.g. "1.2").
 * Tries the redirect first; falls back to the API, which is also the path
 * that works on web, where the github.com page is blocked by CORS.
 */
export async function fetchLatestReleaseVersion(): Promise<string> {
  try {
    return await fetchTagFromRedirect();
  } catch {
    return fetchTagFromApi();
  }
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

// ─── In-app update (Android) ─────────────────────────────────────────────────

/** Where the downloaded APK goes: the app cache, which expo-file-system's FileProvider can share with the installer. */
const UPDATE_APK_PATH = `${FileSystem.cacheDirectory}StackMaster-update.apk`;

/** Anything smaller than this can't be a real StackMaster APK (e.g. an HTML error page saved by mistake). */
const MIN_APK_BYTES = 1_000_000;

export interface UpdateDownload {
  /** Resolves with the downloaded APK's file:// URI, or null if cancelled. */
  done: Promise<string | null>;
  cancel: () => void;
}

/**
 * Downloads the latest release's APK into the app cache, reporting progress.
 * Any half-finished file from an earlier attempt is removed first.
 */
export function downloadUpdateApk(
  onProgress: (receivedBytes: number, totalBytes: number) => void,
): UpdateDownload {
  let cancelled = false;
  const task = FileSystem.createDownloadResumable(
    APP_DOWNLOAD_URL,
    UPDATE_APK_PATH,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) =>
      onProgress(totalBytesWritten, totalBytesExpectedToWrite),
  );

  const done = (async () => {
    await FileSystem.deleteAsync(UPDATE_APK_PATH, { idempotent: true });
    const result = await task.downloadAsync();
    if (cancelled || !result) return null;
    if (result.status !== 200) {
      throw new Error(`Download failed (HTTP ${result.status})`);
    }
    const info = await FileSystem.getInfoAsync(result.uri);
    if (!info.exists || info.size < MIN_APK_BYTES) {
      throw new Error("The downloaded file isn't a valid app package");
    }
    return result.uri;
  })();

  return {
    done,
    cancel: () => {
      cancelled = true;
      task.cancelAsync().catch(() => {});
      FileSystem.deleteAsync(UPDATE_APK_PATH, { idempotent: true }).catch(
        () => {},
      );
    },
  };
}

/** FLAG_GRANT_READ_URI_PERMISSION: lets the system installer read our content:// URI. */
const FLAG_GRANT_READ_URI_PERMISSION = 1;

/**
 * Hands the downloaded APK to Android's package installer, which shows its
 * own "Do you want to update this app?" prompt (sideloaded apps can't
 * install silently). The first time, Android also asks the user to allow
 * StackMaster to "Install unknown apps" (REQUEST_INSTALL_PACKAGES in app.json).
 */
export async function installUpdateApk(fileUri: string): Promise<void> {
  const contentUri = await FileSystem.getContentUriAsync(fileUri);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    type: "application/vnd.android.package-archive",
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}
