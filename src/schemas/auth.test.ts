import { describe, expect, it } from 'vitest';

import { credentialsSchema, inviteCodeSchema } from '@/schemas/auth';

describe('credentialsSchema', () => {
  it('accepts a valid email + password', () => {
    const r = credentialsSchema.safeParse({ email: 'a@b.com', password: 'password1' });
    expect(r.success).toBe(true);
  });

  it('rejects a short password', () => {
    const r = credentialsSchema.safeParse({ email: 'a@b.com', password: 'short' });
    expect(r.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    const r = credentialsSchema.safeParse({ email: 'nope', password: 'password1' });
    expect(r.success).toBe(false);
  });
});

describe('inviteCodeSchema', () => {
  it('uppercases and trims a valid code', () => {
    const r = inviteCodeSchema.parse({ code: '  abcd2345 ' });
    expect(r.code).toBe('ABCD2345');
  });

  it('rejects codes of the wrong length', () => {
    expect(inviteCodeSchema.safeParse({ code: 'ABC123' }).success).toBe(false);
  });

  it('rejects ambiguous/invalid characters after normalization', () => {
    // Not exactly 8 of [A-Z0-9] -> invalid.
    expect(inviteCodeSchema.safeParse({ code: 'ABCD-234' }).success).toBe(false);
  });
});
