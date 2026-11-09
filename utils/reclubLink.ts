const FETCH_TIMEOUT_MS = 15000;

/**
 * Share links open a preview page, not the file itself, so known cloud links
 * are rewritten to their direct-download form. Anything else is fetched as-is.
 *
 * - Drive file: /file/d/<id>/view, /open?id=<id>, /uc?id=<id> → uc?export=download
 * - Google Doc: /document/d/<id>/edit → export?format=txt
 * - Dropbox: ?dl=0 → ?dl=1
 */
export function toDownloadUrl(link: string): string {
  const url = new URL(link.trim());
  const host = url.hostname.toLowerCase();

  if (host === "docs.google.com") {
    const doc = url.pathname.match(/\/document\/d\/([\w-]+)/);
    if (doc) return `https://docs.google.com/document/d/${doc[1]}/export?format=txt`;
  }
  if (host === "drive.google.com" || host === "docs.google.com") {
    const id =
      url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? url.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  if (host.endsWith("dropbox.com")) {
    url.searchParams.set("dl", "1");
    return url.toString();
  }
  return url.toString();
}

/** Downloads the text behind a Reclub export link. Throws an Error whose message is shown to the user as-is. */
export async function fetchReclubText(link: string): Promise<string> {
  let downloadUrl: string;
  try {
    downloadUrl = toDownloadUrl(link);
  } catch {
    throw new Error("That doesn't look like a link. It should start with https://");
  }
  if (!/^https?:$/.test(new URL(downloadUrl).protocol)) {
    throw new Error("Only http(s) links are supported.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(downloadUrl, { signal: controller.signal });
  } catch {
    throw new Error("Couldn't reach that link. Check your internet connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Nothing found at that link. Check that the file still exists."
        : `The link returned an error (${res.status}). Check that the file is shared with "Anyone with the link".`,
    );
  }
  const text = await res.text();
  // A private Drive file answers with a Google sign-in page instead of the file.
  if (/^\s*<(!doctype html|html)/i.test(text)) {
    throw new Error(
      'That link opens a web page, not a text file. In Google Drive, set sharing to "Anyone with the link".',
    );
  }
  return text;
}
