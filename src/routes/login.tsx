import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GOOGLE_OAUTH_ENABLED } from '@/features/auth/context';
import { useAuth } from '@/features/auth/use-auth';
import { credentialsSchema, type Credentials } from '@/schemas/auth';

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

type Mode = 'sign-in' | 'sign-up';

function LoginPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (mode === 'sign-in') {
        await signIn(values);
      } else {
        await signUp(values);
      }
      await navigate({ to: redirect ?? '/app' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    }
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">
          {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {mode === 'sign-in'
            ? 'Sign in to your household.'
            : 'We’ll set up your household automatically.'}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-destructive text-sm">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-destructive text-sm">{errors.password.message}</p>
          )}
        </div>

        {formError && (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting
            ? 'Please wait…'
            : mode === 'sign-in'
              ? 'Sign in'
              : 'Create account'}
        </Button>
      </form>

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!GOOGLE_OAUTH_ENABLED}
          onClick={() => void signInWithGoogle()}
        >
          {GOOGLE_OAUTH_ENABLED ? 'Continue with Google' : 'Google sign-in coming soon'}
        </Button>

        <p className="text-muted-foreground text-center text-sm">
          {mode === 'sign-in' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="text-primary font-medium underline-offset-4 hover:underline"
            onClick={() => {
              setFormError(null);
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            }}
          >
            {mode === 'sign-in' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </main>
  );
}
