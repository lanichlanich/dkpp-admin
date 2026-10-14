-- Existing records stay intact; an unknown birthplace is an empty string.
ALTER TABLE adminflow.employees
  ADD COLUMN IF NOT EXISTS birth_place text NOT NULL DEFAULT '';
