import { strFromU8, unzipSync } from "fflate";

export interface DocFileDTO {
  path: string;
  kind: "markdown" | "text";
  source: string;
}

// ビューア用に展開するファイルの上限。ZIP爆弾や巨大バイナリでWorkerのメモリ・転送量を食わないための安全弁。
const MAX_FILE_BYTES = 512 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 100;

function isSafePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  return path.split("/").every((s) => s !== "" && s !== ".." && s !== ".");
}

function toKind(path: string): "markdown" | "text" {
  return /\.(md|markdown)$/i.test(path) ? "markdown" : "text";
}

/** SKILL.md(最も浅い階層)を先頭に、残りはパス順に並べる */
function sortFiles(files: DocFileDTO[]): DocFileDTO[] {
  const rank = (f: DocFileDTO) => (f.path.toLowerCase().split("/").pop() === "skill.md" ? f.path.split("/").length : 1000);
  return [...files].sort((a, b) => rank(a) - rank(b) || a.path.localeCompare(b.path));
}

/** 単体の .md アセットをビューア用の1ファイルとして返す */
export function singleDocFile(fileName: string, text: string): DocFileDTO[] {
  return [{ path: fileName, kind: toKind(fileName), source: text.slice(0, MAX_FILE_BYTES) }];
}

/** ZIPアセットから、テキストとして表示できるファイルだけを取り出す(バイナリ・巨大ファイルは除外) */
export function docFilesFromZip(buf: Uint8Array): DocFileDTO[] {
  const entries = unzipSync(buf, {
    filter: (f) => !f.name.endsWith("/") && f.originalSize <= MAX_FILE_BYTES && isSafePath(f.name),
  });

  const files: DocFileDTO[] = [];
  let total = 0;
  for (const [path, data] of Object.entries(entries)) {
    if (path.startsWith("__MACOSX/") || path.split("/").pop()?.startsWith("._")) continue;
    if (data.includes(0)) continue; // NUL を含むものはバイナリとみなす
    total += data.byteLength;
    if (files.length >= MAX_FILES || total > MAX_TOTAL_BYTES) break;
    files.push({ path, kind: toKind(path), source: strFromU8(data) });
  }
  return sortFiles(files);
}
