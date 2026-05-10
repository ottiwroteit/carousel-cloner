export function captionCopyScript(): string {
  return `document.querySelector('[data-copy-caption-button]')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const field = document.querySelector('[data-caption-field]');
  const status = document.querySelector('[data-copy-caption-status]');
  const text = field?.value || '';

  function setStatus(message) {
    button.textContent = message;
    if (status) status.textContent = message;
  }

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      setStatus('Copied');
      return;
    }
    throw new Error('Clipboard API unavailable');
  } catch {
    if (field) {
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field.focus({ preventScroll: true });
      field.select();
      field.setSelectionRange(0, text.length);
      const copied = document.execCommand?.('copy');
      setStatus(copied ? 'Copied' : 'Selected. Tap Copy.');
      return;
    }
    setStatus('Copy caption below');
  }
});`;
}
