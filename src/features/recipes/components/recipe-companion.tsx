import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Entry point for the AI recipe companion (decision 0015). The box is the input —
 * you type your question straight into it. For now this is only the affordance;
 * the metered edge function, streamed answers, and the "propose an edit → save as
 * your copy" flow come next. It lives in its own component so wiring the backend
 * in later doesn't disturb the recipe page.
 */
export function RecipeCompanion() {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState(false);

  return (
    <section className="space-y-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim() !== '') setAsked(true);
        }}
      >
        <div className="relative flex-1">
          <Sparkles
            className="text-primary pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            aria-label="Ask about this recipe"
            placeholder="Ask about this recipe…"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={question.trim() === ''}>
          Ask
        </Button>
      </form>

      <p className="text-muted-foreground text-xs">
        Substitutions, doneness, dietary swaps — or make it your own
      </p>

      {asked && (
        <p className="text-muted-foreground text-xs">
          The companion isn’t connected yet — wiring up its answers is the next step.
        </p>
      )}
    </section>
  );
}
