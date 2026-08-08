import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

interface Props {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

/**
 * Full-screen camera barcode scanner. Decoding runs entirely on-device (ZXing,
 * lazily imported so it never touches the main bundle) — no AI, no upload. Prefers
 * the rear camera. Reports the first barcode it reads, then stops the stream.
 */
export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let done = false;

    void (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) return;
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          video,
          (result) => {
            if (result && !done) {
              done = true;
              controls?.stop();
              onDetectedRef.current(result.getText());
            }
          },
        );
      } catch {
        setError('Couldn’t open the camera. Allow camera access and try again.');
      }
    })();

    return () => {
      done = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium text-white">Scan a barcode</span>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={onClose}>
          Cancel
        </Button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Muted + playsInline are required for autoplay on iOS. */}
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {!error && (
          <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2">
            <div className="h-40 rounded-lg border-2 border-white/80" />
            <p className="mt-3 text-center text-sm text-white/80">
              Point at a barcode
            </p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-white">{error}</p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
