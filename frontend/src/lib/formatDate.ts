/**
 * D1(SQLite)の datetime('now') は "YYYY-MM-DD HH:MM:SS" (UTCだがタイムゾーン表記なし) を返すため、
 * そのまま Date に渡すとブラウザのローカルタイムゾーンとして誤解釈される。
 * "Z" を補って明示的にUTCとして解釈させてから変換する(既にISO形式の値はそのまま扱う)。
 */
function parseServerDate(value: string): Date {
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Date(iso);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return parseServerDate(value).toLocaleString("ja-JP");
}

export function isPastDateTime(value: string | null | undefined): boolean {
  if (!value) return false;
  return parseServerDate(value).getTime() <= Date.now();
}
