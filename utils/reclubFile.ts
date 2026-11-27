import { ReclubImportFile } from "@/types";
import { File } from "expo-file-system";

/**
 * Readable name for a picked file's content:// URI. Local files end in their
 * path ("primary:Download/reclub.txt"), but Google Drive URIs only carry an
 * opaque document id, so those get a generic label instead.
 */
function labelForUri(uri: string): string {
  let decoded = uri;
  try {
    decoded = decodeURIComponent(uri);
  } catch {
    // Malformed escapes: fall back to the raw URI.
  }
  const last = decoded.split(/[/:]/).pop() ?? "";
  if (/\.\w{1,5}$/.test(last) && !/[=;]/.test(last)) return last;
  if (uri.includes("com.google.android.apps.docs")) return "Google Drive file";
  return "Saved file";
}

/**
 * Opens the system file picker (which includes Google Drive and other cloud
 * providers) for a text file, starting in the folder of `initialUri` when the
 * provider supports it. Android keeps a persisted read permission on the
 * picked file, so it can be re-read on later launches. Returns null if the
 * user backs out.
 */
export async function pickReclubFile(
  initialUri?: string,
): Promise<{ file: ReclubImportFile; text: string } | null> {
  let picked: File | File[];
  try {
    picked = await File.pickFileAsync(initialUri, "text/*");
  } catch (err) {
    if (err instanceof Error && /cancel/i.test(err.message)) return null;
    throw err;
  }
  const file = Array.isArray(picked) ? picked[0] : picked;
  if (!file) return null;
  return {
    file: { uri: file.uri, label: labelForUri(file.uri) },
    text: await file.text(),
  };
}

/** Re-reads a previously picked file; throws if it was moved, deleted, or access was revoked. */
export function readReclubFile(uri: string): Promise<string> {
  return new File(uri).text();
}
