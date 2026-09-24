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
