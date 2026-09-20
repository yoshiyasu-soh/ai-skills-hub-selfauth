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
