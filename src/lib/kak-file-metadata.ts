export type KakPoFile = { storageName: string; fileName: string; fileSize: number; templateSha256: string };

/** Shared by downloads and backup enumeration; old KAK records have no PO. */
export function readKakPoFile(draftJson: unknown): KakPoFile | undefined {
  try {
    const draft = typeof draftJson === "string" ? JSON.parse(draftJson) : draftJson;
    const file = draft?.poDocument;
    if (!file || !/^[0-9a-f-]{36}\.docx$/i.test(file.storageName) || typeof file.fileName !== "string" || !/^[^/\\\x00-\x1f]+\.docx$/i.test(file.fileName) || !Number.isSafeInteger(file.fileSize) || file.fileSize <= 0 || !/^[0-9a-f]{64}$/.test(file.templateSha256)) return undefined;
    return file as KakPoFile;
  } catch { return undefined; }
}

export function kakBundleFileName(kakFileName: string) {
  return kakFileName.replace(/^Draft-KAK-/, "Draft-PO-dan-KAK-").replace(/\.docx$/i, ".zip");
}

export function kakDocumentRows(row: Record<string, unknown>) {
  const po = readKakPoFile(row.draft_json);
  return [row,
    { ...row, id: `${row.id}-rka`, storage_name: row.source_storage_name, file_name: row.source_name, file_size: row.source_file_size },
    ...(po ? [{ ...row, id: `${row.id}-po`, storage_name: po.storageName, file_name: po.fileName, file_size: po.fileSize }] : []),
  ];
}
