-- =============================================================================
-- ADEY — reference data seed (categories + settings already inserted by migration)
-- This file contains NO businesses, listings, reviews, or revenue. Those must
-- come from real users (or the labelled dev fixtures in supabase/tests).
-- =============================================================================

insert into public.categories (slug, name_en, name_am, icon, markets, sort_order) values
  ('restaurants',           'Restaurants',           'ምግብ ቤቶች',          'restaurant',   '{us,et}', 10),
  ('groceries',             'Groceries',             'ግሮሰሪ',             'grocery',      '{us,et}', 20),
  ('hotels',                'Hotels',                'ሆቴሎች',             'hotel',        '{us,et}', 30),
  ('salons',                'Salons',                'ሳሎን',               'salon',        '{us,et}', 40),
  ('barbershops',           'Barbershops',           'ፀጉር ቤት',           'barber',       '{us,et}', 50),
  ('clothing',              'Clothing',              'ልብስ',               'clothing',     '{us,et}', 60),
  ('cultural-shops',        'Cultural Shops',        'የባህል ሱቆች',         'cultural',     '{us,et}', 70),
  ('coffee-shops',          'Coffee Shops',          'ቡና ቤቶች',           'coffee',       '{us,et}', 80),
  ('event-venues',          'Event Venues',          'የዝግጅት ቦታዎች',      'venue',        '{us,et}', 90),
  ('transportation',        'Transportation',        'ትራንስፖርት',          'transport',    '{us,et}', 100),
  ('professional-services', 'Professional Services', 'ሙያዊ አገልግሎቶች',     'professional', '{us,et}', 110),
  ('home-services',         'Home Services',         'የቤት አገልግሎቶች',      'home',         '{us,et}', 120),
  -- Ethiopian Market product-oriented categories
  ('coffee-tea',            'Coffee & Tea',          'ቡና እና ሻይ',          'coffee-bean',  '{et}',    200),
  ('spices-food',           'Spices & Food',         'ቅመማ ቅመም እና ምግብ',  'spice',        '{et}',    210),
  ('traditional-clothing',  'Traditional Clothing',  'የባህል ልብስ',         'habesha-kemis','{et}',    220),
  ('jewelry-accessories',   'Jewelry & Accessories', 'ጌጣጌጥ',             'jewelry',      '{et}',    230),
  ('art-crafts',            'Art & Crafts',          'ጥበብ እና የእጅ ሥራ',   'art',          '{et}',    240),
  ('books-music',           'Books & Music',         'መጻሕፍት እና ሙዚቃ',   'book',         '{et}',    250),
  ('other',                 'Other',                 'ሌላ',                'other',        '{us,et}', 999)
on conflict (slug) do update set name_en = excluded.name_en, name_am = excluded.name_am, icon = excluded.icon, markets = excluded.markets, sort_order = excluded.sort_order;
