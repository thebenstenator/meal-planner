import { useState } from 'react';

import { BarcodeIcon } from '@/components/icons/barcode';
import { Button } from '@/components/ui/button';
import { BarcodeScanner } from '@/features/scanner/barcode-scanner';
import { lookupBarcode } from '@/features/scanner/open-food-facts';

interface Props {
  /** Called with the looked-up product name so the caller can prefill its add box. */
  onResult: (name: string) => void;
  size?: 'sm' | 'default';
}

/**
 * A "Scan" button that opens the camera, decodes a barcode on-device, looks the
 * product up on Open Food Facts (free), and hands the name back to prefill a
 * type-and-add field. If the product isn't found, it surfaces the raw code so
 * the user can just type the item instead.
 */
export function ScanButton({ onResult, size = 'default' }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleDetected(barcode: string) {
    setOpen(false);
    setBusy(true);
    setMessage(null);
    try {
      const product = await lookupBarcode(barcode);
      if (product) {
        onResult(product.name);
        setMessage(`Found: ${product.name}`);
      } else {
        setMessage(`No product match for ${barcode} — type it in.`);
      }
    } catch {
      setMessage('Lookup failed — type the item in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size={size} disabled={busy} onClick={() => setOpen(true)}>
          {busy ? (
            'Looking up…'
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <BarcodeIcon className="h-4 w-4" />
              Scan
            </span>
          )}
        </Button>
        {message && (
          <span role="status" aria-live="polite" className="text-muted-foreground text-xs">
            {message}
          </span>
        )}
      </div>
      {open && <BarcodeScanner onDetected={handleDetected} onClose={() => setOpen(false)} />}
    </>
  );
}
