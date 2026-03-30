
-- Add anon SELECT policy for visitor_sessions (missing - causing 401 on upsert and 406 on GET)
DROP POLICY IF EXISTS anon_select_sessions ON visitor_sessions;
CREATE POLICY anon_select_sessions ON visitor_sessions
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Recreate anon insert with WITH CHECK including true
DROP POLICY IF EXISTS anon_insert_sessions ON visitor_sessions;
CREATE POLICY anon_insert_sessions ON visitor_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Recreate anon update with both USING and WITH CHECK
DROP POLICY IF EXISTS anon_update_sessions ON visitor_sessions;
CREATE POLICY anon_update_sessions ON visitor_sessions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
