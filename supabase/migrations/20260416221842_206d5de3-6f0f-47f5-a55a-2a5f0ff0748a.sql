INSERT INTO public.global_settings (key, value, description, is_public) VALUES
  ('snapshot_version', 'v1.00', 'Current AI knowledge snapshot version', false),
  ('snapshot_previous_length', '0', 'Char count of last snapshot — used for major-bump diff', false),
  ('snapshot_version_history', '[]', 'Append-only snapshot version history (JSON array)', false),
  ('snapshot_version_major_threshold', '0.15', 'Change ratio threshold for major version bump', false),
  ('snapshot_pending_notes', '', 'Manually-edited pending items / known issues for AI context', false)
ON CONFLICT (key) DO NOTHING;