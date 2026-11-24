import { SlidersHorizontal } from 'lucide-react';

/** Label for the single Filters button on list pages (the search itself lives in the header: SiteSearch). */
export function FiltersLabel() {
  return (
    <>
      <SlidersHorizontal aria-hidden className="h-4 w-4" />
      <span className="max-sm:sr-only">Filters</span>
    </>
  );
}
