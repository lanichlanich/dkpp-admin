export type PublicUser = {
  roleId: string;
  roleName: string;
  isAdministrator: boolean;
  protectedAdministrator: boolean;
  menuPermissions: string[];
  id: string;
  name: string;
  username: string;
  email: string;
  createdAt: string;
};

export type Employee = {
  birthPlace: string;
  nip: string;
  jobPositionId: string | null;
  name: string;
  parentUnit: string;
  unit: string;
  position: string;
  positionType: string;
  echelon: string;
  rank: string;
  asnType: string;
  gender: string;
  status: string;
  retirementAge: number | null;
  createdAt: string;
  updatedAt: string;
};

import { parseMenuPermissions } from "@/lib/access-control";

export function mapPublicUser(row: {
  role_id?: string;
  role_name?: string;
  is_administrator?: number;
  protected_administrator?: number;
  role_permissions?: string;
  menu_permissions?: string | null;
  id: string;
  name: string;
  username: string;
  email: string;
  created_at: string;
}): PublicUser {
  return {
    roleId: row.role_id ?? "unassigned",
    roleName: row.role_name ?? "Belum ditetapkan",
    isAdministrator: row.is_administrator === 1,
    protectedAdministrator: row.protected_administrator === 1,
    menuPermissions: parseMenuPermissions(row.menu_permissions ?? row.role_permissions),
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
  };
}
