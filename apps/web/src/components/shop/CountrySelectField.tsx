import { countriesForPicker } from '@adey/shared';

/** Uncontrolled country picker for plain GET forms (server components). */
export function CountrySelectField({ name, defaultValue, label, className = 'input sm:w-44' }: { name: string; defaultValue?: string; label: string; className?: string }) {
  return (
    <select name={name} defaultValue={defaultValue ?? ''} aria-label={label} className={className}>
      <option value="">{label}: anywhere</option>
      {countriesForPicker.map((c, i) => <option key={`${c.code}-${i}`} value={c.code}>{c.name}</option>)}
    </select>
  );
}
