export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Older browser fallback below. */ }
  }
  const input = document.createElement('textarea');
  const previous = document.activeElement as HTMLElement | null;
  input.value = text; input.readOnly = true;
  input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px';
  document.body.appendChild(input);
  try {
    input.focus(); input.select(); input.setSelectionRange(0, text.length);
    if (!document.execCommand('copy')) throw new Error('Copy failed');
  } finally { input.remove(); previous?.focus(); }
}
