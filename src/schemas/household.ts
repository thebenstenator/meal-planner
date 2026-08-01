import { z } from 'zod';

/** Rename form for the household settings page. */
export const householdSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
});

export type HouseholdSettingsInput = z.infer<typeof householdSettingsSchema>;

export const householdRoleSchema = z.enum(['owner', 'member']);
export type HouseholdRole = z.infer<typeof householdRoleSchema>;
