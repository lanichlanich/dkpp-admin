export function isInactiveJobPositionName(name: string) {
  return name.toLocaleLowerCase("id-ID").includes("penyuluh pertanian");
}
