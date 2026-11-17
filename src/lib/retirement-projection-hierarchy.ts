import { normalizeProjectionUnit, type PositionRequirement, type ProjectedEmployee } from "@/lib/retirement-projection";

export type HierarchyPosition = {
  position: PositionRequirement; parentId: string | null; depth: number; order: number;
};

/** The hierarchy belongs to the approved map, independently of employee filters. */
export function buildProjectionHierarchy(reference: PositionRequirement[]) {
  const root = reference.find(row => row.kind === "Struktural" && normalizeProjectionUnit(row.unit).startsWith("DINAS ")) ?? reference[0];
  if (!root) return { positions: [] as HierarchyPosition[], byId: new Map<string, HierarchyPosition>(), byUnit: new Map<string, HierarchyPosition>() };
  const rootUnit = normalizeProjectionUnit(root.unit);
  const heads = new Map(reference.filter(row => row.kind === "Struktural").map(row => [normalizeProjectionUnit(row.unit), row]));
  const secretariat = [...heads.keys()].find(unit => unit.startsWith("SEKRETARIAT ")) ?? rootUnit;
  const parentUnit = (unit: string) => unit.startsWith("SUB BAGIAN TATA USAHA UPTD ")
    ? unit.replace(/^SUB BAGIAN TATA USAHA /, "") : unit.startsWith("SUB BAGIAN ") ? secretariat : rootUnit;
  const children = new Map<string | null, Array<{ position: PositionRequirement; parentId: string | null }>>();
  for (const position of reference) {
    const unit = normalizeProjectionUnit(position.unit), ownHead = heads.get(unit);
    const parent = position.id === root.id ? null : ownHead?.id === position.id ? heads.get(parentUnit(unit)) ?? root : ownHead ?? root;
    const parentId = parent?.id === position.id ? null : parent?.id ?? null;
    children.set(parentId, [...(children.get(parentId) ?? []), { position, parentId }]);
  }
  const positions: HierarchyPosition[] = [], visited = new Set<string>();
  function visit(position: PositionRequirement, parentId: string | null, depth: number) {
    if (visited.has(position.id)) return;
    visited.add(position.id);
    positions.push({ position, parentId, depth, order: positions.length });
    for (const child of children.get(position.id) ?? []) visit(child.position, position.id, depth + 1);
  }
  for (const node of children.get(null) ?? []) visit(node.position, null, 0);
  for (const position of reference) if (!visited.has(position.id)) visit(position, null, 0);
  const byId = new Map(positions.map(node => [node.position.id, node]));
  const byUnit = new Map(positions.filter(node => node.position.kind === "Struktural").map(node => [normalizeProjectionUnit(node.position.unit), node]));
  return { positions, byId, byUnit };
}
export type ProjectionHierarchy = ReturnType<typeof buildProjectionHierarchy>;

export function selectProjectionHierarchy(hierarchy: ProjectionHierarchy, selectedIds: string[]) {
  const selected = new Set(selectedIds), included = new Set(selectedIds);
  for (const id of selectedIds) {
    let parentId = hierarchy.byId.get(id)?.parentId;
    const visited = new Set([id]);
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId); included.add(parentId);
      parentId = hierarchy.byId.get(parentId)?.parentId;
    }
  }
  return hierarchy.positions.filter(node => included.has(node.position.id)).map(node => ({ ...node, context: !selected.has(node.position.id) }));
}

export function employeeHierarchyLevel(hierarchy: ProjectionHierarchy, employee: ProjectedEmployee) {
  const position = employee.requirementId ? hierarchy.byId.get(employee.requirementId) : undefined;
  const unitHead = hierarchy.byUnit.get(normalizeProjectionUnit(employee.mappedUnit));
  return position ? { depth: position.depth, order: position.order }
    : { depth: unitHead ? unitHead.depth + 1 : 0, order: unitHead ? unitHead.order + 0.5 : Number.MAX_SAFE_INTEGER };
}

export function sortProjectionEmployees(hierarchy: ProjectionHierarchy, employees: ProjectedEmployee[]) {
  return [...employees].sort((a, b) => employeeHierarchyLevel(hierarchy, a).order - employeeHierarchyLevel(hierarchy, b).order
    || a.mappedUnit.localeCompare(b.mappedUnit, "id") || a.position.localeCompare(b.position, "id")
    || (a.retirementTmt ?? "9999").localeCompare(b.retirementTmt ?? "9999") || a.name.localeCompare(b.name, "id"));
}
