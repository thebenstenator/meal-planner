import { z } from 'zod';

/**
 * Primitive building blocks reused across feature schemas. Entity schemas
 * (recipe, plan entry, etc.) arrive with their slices.
 */

/** All money is integer cents (10-conventions.md). Never a float. */
export const centsSchema = z.number().int();

/** Postgres uuid. */
export const uuidSchema = z.string().uuid();

/** A plain calendar date, no time/zone — meals happen on a day, not an instant. */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export type Cents = z.infer<typeof centsSchema>;
export type Uuid = z.infer<typeof uuidSchema>;
export type IsoDate = z.infer<typeof isoDateSchema>;
