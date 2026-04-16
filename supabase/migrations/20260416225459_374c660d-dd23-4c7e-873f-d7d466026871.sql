INSERT INTO global_settings (key, value, description, is_public) VALUES
  ('seo_clarity_id', '', 'Microsoft Clarity project ID', false)
ON CONFLICT (key) DO NOTHING;