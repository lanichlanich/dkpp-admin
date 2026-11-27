const neutral = { backgroundColor: "#f8fafc", accent: "#64748b" };
const preferredHues = [38, 215, 133, 289, 5, 178, 255, 73, 329, 24, 195, 108];

export function scheduleUnitKey(unit: string) {
  return unit.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

export function scheduleUnitColors(units: readonly string[]) {
  const keys = [...new Set(units.map(scheduleUnitKey))].sort();
  let index = 0;
  return new Map(keys.map(key => {
    if (!key) return [key, neutral];
    const hue = preferredHues[index] ?? ((index * 137.508) % 360).toFixed(3);
    index++;
    return [key, { backgroundColor: `hsl(${hue} 64% 94%)`, accent: `hsl(${hue} 55% 34%)` }];
  }));
}
