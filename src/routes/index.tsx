import { createFileRoute, Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Mealplan</h1>
        <p className="text-muted-foreground text-balance">
          Plan the month, consolidate one shopping list, and know the grocery bill
          before you shop.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button asChild size="lg">
          <Link to="/app">Open the app</Link>
        </Button>
      </div>
    </main>
  );
}
