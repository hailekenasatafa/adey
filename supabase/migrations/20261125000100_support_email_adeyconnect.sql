-- Support address on the owned domain. adey.app belongs to another company, so mail sent to
-- support@adey.app never reached Adey Connect. Applied to production on 2026-11-25 (founder approved).
update public.platform_settings
set value = jsonb_set(value, '{support_email}', '"support@adeyconnect.com"'::jsonb),
    updated_at = now()
where key = 'app'
  and value->>'support_email' = 'support@adey.app';
