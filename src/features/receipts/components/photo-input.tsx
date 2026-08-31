import type { ReactNode } from 'react';

/**
 * A hidden file input styled as a label, used to add receipt photos. With
 * `capture` set it asks the OS for the rear camera directly (`capture="environment"`)
 * — the fix for phones/PWAs that otherwise open straight to the gallery. Without
 * it, the picker lets you choose existing photos (and pick several at once).
 *
 * Both scan surfaces (the /receipts page and Finish trip) render one of each so
 * "take a photo" is always one tap away, not buried behind a gallery.
 */
export function PhotoInput({
  onAddFiles,
  capture,
  className,
  children,
}: {
  onAddFiles: (files: FileList | null) => void;
  /** True → open the camera; false/undefined → the file/gallery picker. */
  capture?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={className}>
      <input
        type="file"
        accept="image/*"
        // The camera returns one shot; the gallery can add several.
        {...(capture ? { capture: 'environment' as const } : { multiple: true })}
        className="hidden"
        onChange={(e) => onAddFiles(e.target.files)}
      />
      {children}
    </label>
  );
}
