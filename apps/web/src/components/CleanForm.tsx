'use client';
import type { ComponentProps } from 'react';

/**
 * A plain GET form that leaves empty fields out of the URL (so "Any" choices don't add `size=&visitors=`).
 * Without JavaScript it submits normally; empty fields are just harmless.
 */
export function CleanForm(props: ComponentProps<'form'>) {
  const onSubmit: NonNullable<ComponentProps<'form'>['onSubmit']> = (e) => {
    props.onSubmit?.(e);
    const empty = [...e.currentTarget.elements].filter((el): el is HTMLInputElement | HTMLSelectElement =>
      (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && !!el.name && !el.disabled && el.value === '');
    empty.forEach((el) => { el.disabled = true; });
    // Re-enable after the browser has read the form, so Back (page cache) shows a usable form.
    setTimeout(() => empty.forEach((el) => { el.disabled = false; }), 0);
  };
  return <form {...props} onSubmit={onSubmit} />;
}
