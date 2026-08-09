/** A simple monochrome barcode glyph for the "Scan" button. */
export function BarcodeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="5" width="1.6" height="14" />
      <rect x="4.8" y="5" width="1" height="14" />
      <rect x="7.2" y="5" width="2.2" height="14" />
      <rect x="10.6" y="5" width="1" height="14" />
      <rect x="13" y="5" width="1.6" height="14" />
      <rect x="16" y="5" width="1" height="14" />
      <rect x="18.4" y="5" width="2.6" height="14" />
    </svg>
  );
}
