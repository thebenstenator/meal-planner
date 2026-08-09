import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import { stripControlChars } from '@/lib/utils/sanitize-text';

// pdf.js parses in a web worker. Point it at the bundled worker asset. This
// whole module is dynamically imported (see the bulk-import page) so pdf.js only
// loads when someone actually processes a PDF.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Extract a PDF's text layer entirely in the browser — no AI. Lines are
 * reconstructed by grouping text items on the same vertical position. Returns an
 * empty string for scans / image-only PDFs (no text layer), which the caller
 * treats as "unreadable".
 */
export async function extractPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const byRow = new Map<number, { x: number; s: string }[]>();

    for (const item of content.items) {
      if (!('str' in item) || item.str === '') continue;
      const y = Math.round(item.transform[5] as number);
      const row = byRow.get(y) ?? [];
      row.push({ x: item.transform[4] as number, s: item.str });
      byRow.set(y, row);
    }

    for (const y of [...byRow.keys()].sort((a, b) => b - a)) {
      const line = (byRow.get(y) as { x: number; s: string }[])
        .sort((a, b) => a.x - b.x)
        .map((o) => o.s)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (line) lines.push(line);
    }
  }

  // Strip NUL/control bytes the text layer can carry — Postgres text rejects them.
  return stripControlChars(lines.join('\n').trim());
}
