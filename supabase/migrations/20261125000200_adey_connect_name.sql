-- Brand name: "Adey" becomes "Adey Connect" in everything members see (founder decision, 2026-11-25).
-- Only wording changes: function signatures, behaviour, owners and grants stay the same.
-- Historical records (notifications already sent, chat messages, order history) are left as written.

-- 1. Help centre articles
update public.help_articles
set title   = regexp_replace(title,   '\mAdey\M(?! Connect)', 'Adey Connect', 'g'),
    summary = regexp_replace(summary, '\mAdey\M(?! Connect)', 'Adey Connect', 'g'),
    body    = regexp_replace(body,    '\mAdey\M(?! Connect)', 'Adey Connect', 'g')
where concat_ws(' ', title, summary, body) ~ '\mAdey\M(?! Connect)';

-- 2. Programme names kept in settings
update public.platform_settings
set value = jsonb_set(value, '{program_name}', '"Adey Connect Rewards"'::jsonb),
    description = regexp_replace(description, '\mAdey\M(?! Connect)', 'Adey Connect', 'g'),
    updated_at = now()
where key = 'loyalty' and value->>'program_name' = 'Adey Rewards';

update public.platform_settings
set value = jsonb_set(value, '{assistant_name}', '"Adey Connect Assistant"'::jsonb),
    updated_at = now()
where key = 'support' and value->>'assistant_name' = 'Adey Assistant';

-- 3. Text written by database functions (notifications, error messages, order history notes)
do $$
declare r record;
begin
  for r in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosrc ~ '\mAdey\M(?! Connect)'
  loop
    execute regexp_replace(pg_get_functiondef(r.oid), '\mAdey\M(?! Connect)', 'Adey Connect', 'g');
  end loop;
end $$;

-- 4. Name shown for members with a private profile
do $$
declare v_def text; v_opts text[];
begin
  select pg_get_viewdef(c.oid), c.reloptions into v_def, v_opts
  from pg_class c where c.oid = 'public.public_profiles'::regclass;
  if v_def ~ '\mAdey\M(?! Connect)' then
    execute format('create or replace view public.public_profiles%s as %s',
      case when v_opts is null then '' else ' with (' || array_to_string(v_opts, ', ') || ')' end,
      regexp_replace(v_def, '\mAdey\M(?! Connect)', 'Adey Connect', 'g'));
  end if;
end $$;
