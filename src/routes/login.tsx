import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-muted-foreground">
        Email/password and Google sign-in arrive in Slice&nbsp;1. This is the
        placeholder the protected-route guard redirects to.
      </p>
    </main>
  );
}
