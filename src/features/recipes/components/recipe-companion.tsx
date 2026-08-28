import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHousehold } from '@/features/household/use-household';
import {
  askCompanion,
  type CompanionMessage,
  type CompanionRecipe,
} from '@/features/recipes/companion';
import { ImportError } from '@/features/recipes/import';
import { cn } from '@/lib/utils/cn';

/**
 * The AI recipe companion (decision 0015): ask a question about the recipe on
 * screen and get a grounded answer. The box is the input — you type straight
 * into it. Metered per question server-side; hitting the limit shows a gentle
 * premium nudge. Edits ("halve the sugar" → save as your copy) come next.
 */
export function RecipeCompanion({ recipe }: { recipe: CompanionRecipe }) {
  const { householdId } = useHousehold();
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const ask = useMutation({
    mutationFn: (conversation: CompanionMessage[]) =>
      askCompanion(householdId as string, recipe, conversation),
    onSuccess: (res) =>
      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer }]),
    onError: (err, conversation) => {
      if (err instanceof ImportError && err.limitReached) setLimitReached(true);
      else setError(err instanceof Error ? err.message : 'Something went wrong');
      // The question didn't land — drop it from the thread and put it back in the
      // box so a retry is one tap, not a retype.
      setMessages((prev) => prev.slice(0, -1));
      setQuestion(conversation[conversation.length - 1]?.content ?? '');
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q === '' || !householdId || ask.isPending) return;
    setError(null);
    setLimitReached(false);
    const conversation: CompanionMessage[] = [...messages, { role: 'user', content: q }];
    setMessages(conversation);
    setQuestion('');
    ask.mutate(conversation);
  }

  return (
    <section className="space-y-3">
      <form className="flex items-center gap-2" onSubmit={submit}>
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
            disabled={ask.isPending}
          />
        </div>
        <Button type="submit" disabled={ask.isPending || question.trim() === ''}>
          {ask.isPending ? 'Asking…' : 'Ask'}
        </Button>
      </form>

      {messages.length === 0 && !ask.isPending && (
        <p className="text-muted-foreground text-xs">
          Substitutions, doneness, dietary swaps — or make it your own
        </p>
      )}

      {messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={cn(
                'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                m.role === 'user' ? 'bg-primary/10 ml-auto' : 'bg-muted',
              )}
            >
              {m.content}
            </div>
          ))}
        </div>
      )}

      {ask.isPending && <p className="text-muted-foreground text-sm">Thinking…</p>}

      {limitReached && (
        <p className="text-muted-foreground text-sm">
          You’ve used your AI credits for this month — the companion is part of premium.
        </p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </section>
  );
}
