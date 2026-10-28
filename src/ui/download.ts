/**
 * Hand the pilot a file. On iPhone Safari this opens the share/save sheet;
 * elsewhere it lands in Downloads. Presentation plumbing only — what goes in
 * the file is decided by the caller.
 */
export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking straight away can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type SaveFileResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hand the pilot a file the way the device handles it best. An iPhone Home
 * Screen app opens a blob link in a viewer with no obvious way out, so where
 * the share sheet accepts files it is used instead ("Save to Files",
 * AirDrop, Mail). A cancelled share sheet is reported as such, so the caller
 * never claims a file was saved when it was not. Other failures throw.
 */
export async function saveFile(filename: string, text: string, mime: string): Promise<SaveFileResult> {
  const file = typeof File === 'undefined' ? null : new File([text], filename, { type: mime });
  if (file && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (err) {
      if ((err as { name?: unknown } | null)?.name === 'AbortError') return 'cancelled';
      throw err;
    }
  }
  downloadText(filename, text, mime);
  return 'downloaded';
}
