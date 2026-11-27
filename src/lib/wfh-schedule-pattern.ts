import type { WorkLocation } from "@/lib/wfh-schedule";

export function continueFridayStatuses(previous: readonly WorkLocation[], count: number): WorkLocation[] {
  const last = previous.at(-1);
  if (!last || count <= 0) return [];
  const mixed = previous.includes("WFH") && previous.includes("WFO");
  const first = last === "WFO" && mixed ? "WFH" : previous[0];

  // Only a mixed schedule ending in WFO gets priority for WFH at the boundary.
  const start = previous.indexOf(first);
  const rotate = (offset: number) => Array.from({ length: count }, (_, index) => previous[(offset + index) % previous.length]);
  for (let offset = start; offset < previous.length; offset++) {
    if (previous[offset] !== first) continue;
    const result = rotate(offset);
    if (!mixed || result.some(status => status !== first)) return result;
  }
  // Keep at least one of each status even if the target month has fewer Fridays.
  const result = rotate(start);
  if (count > 1) result[count - 1] = first === "WFH" ? "WFO" : "WFH";
  return result;
}
