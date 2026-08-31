import { BookOpen, CalendarDays, Lightbulb, Refrigerator, ShoppingCart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
}

/**
 * The day-to-day destinations, shared by the top header (desktop) and the mobile
 * bottom bar so the two can't drift. Occasional/settings pages live in the user
 * menu, not here.
 */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/planner', label: 'Plan', Icon: CalendarDays },
  { to: '/suggest', label: 'Ideas', Icon: Lightbulb },
  { to: '/recipes', label: 'Recipes', Icon: BookOpen },
  { to: '/pantry', label: 'Pantry', Icon: Refrigerator },
  { to: '/shopping-list', label: 'List', Icon: ShoppingCart },
];
