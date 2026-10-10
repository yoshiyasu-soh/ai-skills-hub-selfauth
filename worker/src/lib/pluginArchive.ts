import { strToU8, unzipSync, zipSync } from "fflate";
import type { Env, ItemRow } from "../types";
import { readModArchive, repackageMod } from "./modArchive";

const SKILL_MD_FILENAME = "skill.md";

// スキルZIPの展開上限。Workerのメモリ(128MB)を食い潰すZIP爆弾を、展開前(ヘッダーの宣言サイズ)で止める。
const SKILL_ZIP_MAX_ENTRIES = 1000;
const SKILL_ZIP_MAX_ENTRY_BYTES = 25 * 1024 * 1024;
const SKILL_ZIP_MAX_TOTAL_BYTES = 40 * 1024 * 1024;

/**
 * スキルのZIPを上限付きで展開する。壊れている、またはファイル数・サイズが上限を超える場合は null。
 * 投稿時の検証と、プラグイン形式への変換の両方で使う(壊れたZIP1件で marketplace.json 全体が
 * 失敗しないよう、展開エラーを例外のまま外へ出さない)。
 */
export function unzipSkillArchive(buf: Uint8Array): Record<string, Uint8Array> | null {
  try {
    let count = 0;
    let total = 0;
    return unzipSync(buf, {
      filter: (f) => {
        if (f.name.endsWith("/")) return false;
        count++;
        total += f.originalSize;
        if (count > SKILL_ZIP_MAX_ENTRIES) throw new Error("too many entries");
        if (f.originalSize > SKILL_ZIP_MAX_ENTRY_BYTES || total > SKILL_ZIP_MAX_TOTAL_BYTES) throw new Error("too large");
        return true;
      },
    });
  } catch {
    return null;
  }
}

export interface PluginPackage {
  zipBytes: Uint8Array;
  sha256Hex: string;
}

/**
 * zip再パッケージ時の展開先相対パスとして安全かどうかを判定する(Zip Slip対策)。
 * アップロードされたzipの中身は投稿者が自由に決められるため、".."による親ディレクトリ脱出や
 * 絶対パスを許すと、このプラグインを別の利用者がインストールした際に展開先の意図しない場所へ
 * 書き込まれる恐れがある。
 */
function isSafeRelativePath(relative: string): boolean {
  if (!relative || relative.startsWith("/") || relative.includes("\\") || relative.includes("\0")) return false;
  return relative.split("/").every((segment) => segment !== "" && segment !== ".." && segment !== ".");
}

/** ZIP内のエントリから SKILL.md を探す。最も浅い階層にあるものを採用する。見つからなければ null。 */
function findSkillMdPath(entries: Record<string, Uint8Array>): string | null {
  const candidates = Object.keys(entries).filter(
    (path) => !path.endsWith("/") && path.toLowerCase().split("/").pop() === SKILL_MD_FILENAME,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.split("/").length - b.split("/").length);
  return candidates[0];
}

/**
 * Claude Codeのプラグイン名(plugin.json の name / marketplace.jsonのplugins[].name)として使う
 * 識別子をタイトルから組み立てる。プラグイン名は非ASCII文字を許容しないため、日本語タイトルの
 * 場合は空になり得る(その場合は id 由来のフォールバックを使う)。一意性は id の先頭8文字を
 * 末尾に付与して担保する。
 * フロントエンド側(frontend/src/lib/installName.ts の pluginIdentifier)で同じロジックを
 * 再現して表示用インストールコマンドを組み立てているため、変更する場合は両方を揃えること。
 */
export function pluginIdentifier(item: Pick<ItemRow, "id" | "title"> & { type?: string }): string {
  const base = item.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = item.id.slice(0, 8);
  return base ? `${base}-${suffix}` : `${item.type === "mod" ? "mod" : "skill"}-${suffix}`;
}

function buildPluginJson(item: ItemRow, authorName: string): Uint8Array {
  return strToU8(
    JSON.stringify(
      {
        name: pluginIdentifier(item),
        version: item.version,
        description: item.summary || item.title,
        displayName: item.title,
        author: { name: authorName },
      },
      null,
      2,
    ),
  );
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * type=skillのアイテムから Claude Code プラグイン形式(.claude-plugin/plugin.json + skills/<id>/...)の
 * zipを新規に組み立て、R2にキャッシュ保存してitemsテーブルを更新する。
 * ZIP形式で投稿されたスキルの場合、内部にSKILL.mdが見つからなければ変換不能として null を返す
 * (マーケットプレイス一覧からは除外される)。
 */
export async function buildAndCachePluginPackage(
  env: Env,
  item: ItemRow,
  authorName: string,
): Promise<PluginPackage | null> {
  if ((item.type !== "skill" && item.type !== "mod") || !item.r2_key || !item.file_name) return null;

  const obj = await env.ASSETS_BUCKET.get(item.r2_key);
  if (!obj) return null;

  const identifier = pluginIdentifier(item);

  // mod は最初からプラグインなので、包み直さずにルートを揃えて name/version だけ書き換えて配信する
  if (item.type === "mod") {
    const parsed = readModArchive(new Uint8Array(await obj.arrayBuffer()));
    if (!parsed.ok) return null;
    return cachePluginZip(env, item, repackageMod(parsed.pkg, { identifier, version: item.version, title: item.title }));
  }

  const files: Record<string, Uint8Array> = {
    ".claude-plugin/plugin.json": buildPluginJson(item, authorName),
  };

  if (item.file_name.toLowerCase().endsWith(".md")) {
    const text = await obj.text();
    files[`skills/${identifier}/SKILL.md`] = strToU8(text);
  } else {
    const entries = unzipSkillArchive(new Uint8Array(await obj.arrayBuffer()));
    if (!entries) return null;
    const skillMdPath = findSkillMdPath(entries);
    if (!skillMdPath) return null;

    const skillRoot = skillMdPath.includes("/") ? skillMdPath.slice(0, skillMdPath.lastIndexOf("/") + 1) : "";
    for (const [path, data] of Object.entries(entries)) {
      if (path.endsWith("/") || !path.startsWith(skillRoot)) continue;
      const relative = path.slice(skillRoot.length);
      if (!isSafeRelativePath(relative)) continue;
      files[`skills/${identifier}/${relative}`] = data;
    }
  }

  return cachePluginZip(env, item, zipSync(files));
}

async function cachePluginZip(env: Env, item: ItemRow, zipBytes: Uint8Array): Promise<PluginPackage> {
  const hash = await sha256Hex(zipBytes);
  const archiveKey = `plugin-archives/${item.id}.zip`;

  await env.ASSETS_BUCKET.put(archiveKey, zipBytes, {
    httpMetadata: { contentType: "application/zip" },
  });
  await env.DB.prepare(
    `UPDATE items SET plugin_archive_r2_key = ?, plugin_archive_sha256 = ?, plugin_archive_source_r2_key = ? WHERE id = ?`,
  )
    .bind(archiveKey, hash, item.r2_key, item.id)
    .run();

  return { zipBytes, sha256Hex: hash };
}

/**
 * すでに有効なキャッシュ(r2_keyが更新されていない)があればR2から読み出して再利用し、
 * なければ新規に組み立てる。マーケットプレイス一覧生成・archive配信の両方から使う。
 */
export async function getOrBuildPluginPackage(
  env: Env,
  item: ItemRow,
  authorName: string,
): Promise<PluginPackage | null> {
  const cacheValid =
    Boolean(item.plugin_archive_sha256) &&
    Boolean(item.plugin_archive_r2_key) &&
    item.plugin_archive_source_r2_key === item.r2_key;

  if (cacheValid) {
    const cached = await env.ASSETS_BUCKET.get(item.plugin_archive_r2_key as string);
    if (cached) {
      return { zipBytes: new Uint8Array(await cached.arrayBuffer()), sha256Hex: item.plugin_archive_sha256 as string };
    }
  }

  return buildAndCachePluginPackage(env, item, authorName);
}
