/**
 * Scratch CLI for the ingredient engine (specs/05 demo).
 *
 *   npm run consolidate -- scripts/sample-ingredients.txt
 *   cat lines.txt | npm run consolidate
 *
 * Reads a text file (or stdin) of raw ingredient lines, parses each, groups by
 * cleaned name as a stand-in for canonical matching (the real matcher arrives
 * in Slice 3), and prints the consolidated shopping list.
 */
import { readFileSync } from 'node:fs';

import { consolidate } from '@/lib/ingredients/consolidate';
import { parse } from '@/lib/ingredients/parse';
import type { CanonicalInfo, ConsolidationInput } from '@/lib/ingredients/types';

// A tiny demo canonical table keyed by cleaned name, so the CLI can show off
// density merges, count conversion, and package rounding. The app will load
// this from the canonical_ingredient table instead.
const DEMO_CANONICALS: Record<string, CanonicalInfo> = {
  'cream cheese': {
    id: 'cream cheese',
    name: 'cream cheese',
    category: 'dairy',
    defaultUnit: 'oz',
    unitSize: { quantity: 8, unit: 'oz' },
  },
  'all-purpose flour': {
    id: 'all-purpose flour',
    name: 'all-purpose flour',
    category: 'pantry',
    defaultUnit: 'g',
    densityGPerMl: 0.53,
    unitSize: { quantity: 2270, unit: 'g' }, // 5 lb bag
  },
  'ground beef': {
    id: 'ground beef',
    name: 'ground beef',
    category: 'meat',
    defaultUnit: 'lb',
    unitSize: { quantity: 1, unit: 'lb' },
  },
};

function readInput(): string {
  const path = process.argv[2];
  if (path) return readFileSync(path, 'utf8');
  return readFileSync(0, 'utf8'); // stdin
}

function main(): void {
  const raw = readInput();
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const inputs: ConsolidationInput[] = lines.map((line) => {
    const p = parse(line);
    return {
      canonicalId: p.name,
      quantity: p.quantity,
      unit: p.unit,
      name: p.name,
      ref: line,
    };
  });

  const items = consolidate(inputs, (id) => DEMO_CANONICALS[id]);

  console.log(`\nConsolidated ${items.length} item(s) from ${lines.length} line(s):\n`);

  const byCategory = new Map<string, typeof items>();
  for (const item of items) {
    const cat = item.category ?? 'other';
    const bucket = byCategory.get(cat) ?? [];
    bucket.push(item);
    byCategory.set(cat, bucket);
  }

  for (const [cat, bucket] of [...byCategory.entries()].sort()) {
    console.log(cat.toUpperCase());
    for (const item of bucket) {
      if (item.unresolved) {
        const parts = item.subTotals.map((s) => `${trim(s.quantity)} ${s.unit}`).join(' + ');
        console.log(`  ${item.name} — couldn't merge: ${parts}  [set a conversion]`);
      } else if (item.totalQuantity === null) {
        console.log(`  ${item.name} — (to taste / as needed)`);
      } else {
        let line = `  ${item.name} — ${trim(item.totalQuantity)} ${item.unit}`;
        if (item.purchase) {
          const { packages, packageQuantity, packageUnit, totalPurchaseQuantity } = item.purchase;
          line += `  [buy ${packages} × ${trim(packageQuantity)} ${packageUnit} = ${trim(totalPurchaseQuantity)} ${packageUnit}]`;
        }
        console.log(line);
      }
      if (item.noQuantityCount > 0 && item.totalQuantity !== null) {
        console.log(`      (+${item.noQuantityCount} "to taste" reminder)`);
      }
    }
    console.log('');
  }
}

function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

main();
