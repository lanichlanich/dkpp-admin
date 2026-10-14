CREATE TABLE IF NOT EXISTS adminflow.app_roles (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_administrator integer NOT NULL DEFAULT 0 CHECK (is_administrator IN (0, 1)),
  menu_permissions text NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO adminflow.app_roles (id, name, is_administrator, menu_permissions) VALUES
  ('administrator', 'Administrator', 1, '[]'),
  ('perencana', 'Perencana', 0, '["pembuatan-kak"]'),
  ('unassigned', 'Belum ditetapkan', 0, '[]')
ON CONFLICT (id) DO NOTHING;
ALTER TABLE adminflow.users ADD COLUMN IF NOT EXISTS role_id text NOT NULL DEFAULT 'unassigned' REFERENCES adminflow.app_roles(id);
ALTER TABLE adminflow.users ADD COLUMN IF NOT EXISTS menu_permissions text;
ALTER TABLE adminflow.users ADD COLUMN IF NOT EXISTS is_active integer NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
ALTER TABLE adminflow.users ADD COLUMN IF NOT EXISTS protected_administrator integer NOT NULL DEFAULT 0 CHECK (protected_administrator IN (0, 1));
UPDATE adminflow.users SET role_id = 'administrator', is_active = 1, protected_administrator = 1
  WHERE lower(email) = 'admin1@dkpp.com';
CREATE INDEX IF NOT EXISTS users_role_id_idx ON adminflow.users(role_id);
ALTER TABLE adminflow.app_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.app_roles FROM public, anon, authenticated;
