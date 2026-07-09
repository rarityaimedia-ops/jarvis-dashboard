// Shared obsidian:// opener with copy-path fallback (v1 logic, extracted).

export function openInObsidian(
  filePath: string,
  onFallback: (msg: string) => void
) {
  if (!filePath) return;
  const file = filePath.replace(/\.md$/i, "");
  window.location.href = `obsidian://open?vault=brain&file=${encodeURIComponent(file)}`;
  // if the protocol handler didn't steal focus, assume it failed
  setTimeout(() => {
    if (document.hasFocus()) {
      navigator.clipboard.writeText(filePath).catch(() => {});
      onFallback(`Obsidian didn't open — path copied: ${filePath}`);
    }
  }, 1500);
}
