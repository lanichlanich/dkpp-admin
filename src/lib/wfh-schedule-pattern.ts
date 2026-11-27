import type { WorkLocation } from "@/lib/wfh-schedule";

export function continueFridayStatuses(previous: readonly WorkLocation[], count: number): WorkLocation[] {
  const last = previous.at(-1);
  if (!last || count <= 0) return [];
  const first = last === "WFO" ? "WFH" : "WFO";
  const start = previous.indexOf(first);
  if (start < 0) return Array.from({ length: count }, () => last);

  // Rotate the source month, retaining its distribution when both months have equal length.
  const rotate = (offset: number) => Array.from({ length: count }, (_, index) => previous[(offset + index) % previous.length]);
  for (let offset = start; offset < previous.length; offset++) {
    if (previous[offset] !== first) continue;
    const result = rotate(offset);
    if (result.includes(last)) return result;
  }
  // A shorter target must not accidentally turn a mixed schedule into a permanent uniform one.
  const result = rotate(start);
  if (count > 1) result[count - 1] = last;
  return result;
}
