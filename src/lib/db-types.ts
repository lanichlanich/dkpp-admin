export type PublicUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  createdAt: string;
};

export type Employee = {
  nip: string;
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

export function mapPublicUser(row: {
  id: string;
  name: string;
  username: string;
  email: string;
  created_at: string;
}): PublicUser {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
  };
}
