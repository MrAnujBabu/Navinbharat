INSERT INTO public.site_settings (key, value) VALUES
  ('player_infinity_mask_enabled', 'true'),
  ('player_label_mask_enabled', 'true')
ON CONFLICT (key) DO NOTHING;