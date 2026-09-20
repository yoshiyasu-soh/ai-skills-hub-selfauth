export interface VersionDTO {
  id: number;
  version: string;
  body: string;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;
}

export interface VersionRow {
  id: number;
  version: string;
  body: string;
  r2_key: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

export function toVersionDTO(row: VersionRow): VersionDTO {
  return {
    id: row.id,
    version: row.version,
    body: row.body,
    fileName: row.file_name,
    fileSize: row.file_size,
    createdAt: row.created_at,
  };
}
