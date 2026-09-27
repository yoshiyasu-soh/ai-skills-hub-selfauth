/**
 * インストールコマンドで使うディレクトリ名をタイトルから組み立てる。
 * DB側の item.slug は一意性確保のためランダムな8桁サフィックスを含むが、
 * ローカルのフォルダ名としては不要かつ見苦しいため、ここではサフィックス無しで生成する
 * (自分のマシン内でのフォルダ名重複は許容し、一意性は求めない)。
 */
export function installDirName(title: string, fallback: string): string {
  const allowed = /[^a-z0-9぀-ゟ゠-ヿ一-鿿-]+/g;
  const base = title
    .trim()
    .toLowerCase()
    .replace(allowed, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base || fallback;
}

/**
 * Claude Codeのプラグイン名としてサーバーが実際に生成する識別子と同じものを、
 * クライアント側で(APIを呼ばずに)再現する。プラグイン名は非ASCII文字を許容しないため、
 * `installDirName` とは別に、ASCII以外を除去するロジックにしている。
 * worker/src/lib/pluginArchive.ts の pluginIdentifier と必ず同じロジックを保つこと。
 */
export function pluginIdentifier(title: string, itemId: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = itemId.slice(0, 8);
  return base ? `${base}-${suffix}` : `skill-${suffix}`;
}
