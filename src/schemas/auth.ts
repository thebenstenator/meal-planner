import { z } from 'zod';

/** Sign-in / sign-up form input. Shared source of truth for the auth forms. */
export const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type Credentials = z.infer<typeof credentialsSchema>;

/** Join-by-code form input. Codes are uppercased, unambiguous 8-char strings. */
export const inviteCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{8}$/, 'Enter the 8-character invite code')),
});

export type InviteCodeInput = z.infer<typeof inviteCodeSchema>;
