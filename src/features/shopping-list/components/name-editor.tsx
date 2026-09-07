import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Inline "rename this item" field. Enter (or Save) commits the trimmed text;
 * Escape (or Cancel) backs out. Kept generic so both the quick list and the full
 * list share one editor. Callers wrap it in `data-no-toggle` so editing a row
 * doesn't also check it off.
 */
export function NameEditor({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  return (
    <span className="flex items-center gap-1.5">
      <Input
        autoFocus
        aria-label="Item name"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSave(text.trim());
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        className="h-8"
      />
      <Button
        type="button"
        size="sm"
        className="h-8"
        // Beat the input's blur so the click lands.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSave(text.trim())}
      >
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onCancel}>
        Cancel
      </Button>
    </span>
  );
}
