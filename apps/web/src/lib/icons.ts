/**
 * One place that decides which Lucide icon stands for what on the website, so the same idea always
 * gets the same icon. The website never uses emojis (see scripts/check-no-emoji.mjs).
 */
import {
  Amphora, Bean, BedDouble, BookOpen, Briefcase, Car, Coffee, CookingPot, Gem, LayoutGrid, Palette, PartyPopper,
  Scissors, Shirt, ShoppingBasket, Sparkles, Utensils, Wrench, Spool,
  Store, TicketPercent, CalendarDays, MonitorPlay,
  type LucideIcon,
} from 'lucide-react';

/** Main sections of the site. */
export const sectionIcons = { market: Store, deals: TicketPercent, events: CalendarDays, adconnect: MonitorPlay } as const;

/** categories.icon keys (database) to icons. Unknown keys fall back to a neutral grid. */
const CATEGORY: Record<string, LucideIcon> = {
  restaurant: Utensils,
  grocery: ShoppingBasket,
  hotel: BedDouble,
  salon: Sparkles,
  barber: Scissors,
  clothing: Shirt,
  cultural: Amphora,
  coffee: Coffee,
  venue: PartyPopper,
  transport: Car,
  professional: Briefcase,
  home: Wrench,
  'coffee-bean': Bean,
  spice: CookingPot,
  'habesha-kemis': Spool,
  jewelry: Gem,
  art: Palette,
  book: BookOpen,
  other: LayoutGrid,
};

export const categoryIcon = (key: string | null | undefined): LucideIcon => (key && CATEGORY[key]) || LayoutGrid;
