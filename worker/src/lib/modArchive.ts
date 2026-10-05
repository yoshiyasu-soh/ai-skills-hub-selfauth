import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/**
 * Claude Code の mod(`.claude-plugin/plugin.json` + `hooks/hooks.json` の `modules` が指すフックモジュール
 * を持つプラグイン)をZIPとして受け取り、検証・静的スキャン・マーケットプレイス用の再パッケージを行う。
 * mod はユーザー権限で動くコードなので、投稿時に「何を呼ぶか」を列挙して利用者に見せる。
 */

const MAX_ENTRIES = 500;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_ENTRY_BYTES = 5 * 1024 * 1024;
const MANIFEST_SUFFIX = ".claude-plugin/plugin.json";
const SOURCE_EXT = /\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)$/i;

export interface ModPackage {
  /** ZIP内でプラグインのルートに当たる接頭辞("" または "wrapper/") */
  root: string;
  /** ルート相対パス → 内容 */
  files: Record<string, Uint8Array>;
  manifest: Record<string, unknown>;
  /** hooks.json の modules をルート相対パスに解決したもの */
  modules: string[];
}

export type ReadModResult = { ok: true; pkg: ModPackage } | { ok: false; error: string };

export type RiskLevel = "high" | "medium" | "low";

export interface ModFinding {
  kind: "call" | "hook";
  name: string;
  level: Exclude<RiskLevel, "low">;
  label: string;
}

export interface ModScan {
  pluginName: string;
  modules: string[];
  hooks: string[];
  calls: string[];
  envReads: string[];
  envWrites: string[];
  findings: ModFinding[];
  level: RiskLevel;
}

function isSafePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  return path.split("/").every((s) => s !== "" && s !== ".." && s !== ".");
}

/** hooks.json からの相対パス("./register.js" 等)を、プラグインルート相対のパスに解決する。ルートの外に出る場合は null */
function resolveModulePath(spec: string): string | null {
  const parts: string[] = ["hooks"];
  for (const seg of spec.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts.length > 0 ? parts.join("/") : null;
}

export function readModArchive(buf: Uint8Array): ReadModResult {
  let entries: Record<string, Uint8Array>;
  try {
    let count = 0;
    let total = 0;
    entries = unzipSync(buf, {
      filter: (f) => {
        if (f.name.endsWith("/")) return false;
        count++;
        total += f.originalSize;
        if (count > MAX_ENTRIES) throw new Error("too many entries");
        if (f.originalSize > MAX_ENTRY_BYTES || total > MAX_TOTAL_BYTES) throw new Error("too large");
        return true;
      },
    });
  } catch {
    return { ok: false, error: "ZIPを展開できません(壊れている、またはファイル数・サイズが上限を超えています)" };
  }

  const all: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(entries)) {
    if (path.startsWith("__MACOSX/") || path.split("/").pop()?.startsWith("._")) continue;
    if (!isSafePath(path)) return { ok: false, error: `ZIP内に不正なパスがあります: ${path}` };
    all[path] = data;
  }

  // プラグインのルート: ZIP直下、または1階層のフォルダの中にある .claude-plugin/plugin.json
  const manifestPath = Object.keys(all)
    .filter((p) => p === MANIFEST_SUFFIX || (p.endsWith("/" + MANIFEST_SUFFIX) && p.split("/").length === 3))
    .sort((a, b) => a.length - b.length)[0];
  if (!manifestPath) {
    return { ok: false, error: "ZIPの中に .claude-plugin/plugin.json が見つかりません(プラグインのフォルダをそのままZIPにしてください)" };
  }
  const root = manifestPath.slice(0, manifestPath.length - MANIFEST_SUFFIX.length);

  let manifest: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(strFromU8(all[manifestPath]));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    manifest = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, error: ".claude-plugin/plugin.json がJSONとして読めません" };
  }
  if (typeof manifest.name !== "string" || !manifest.name.trim()) {
    return { ok: false, error: ".claude-plugin/plugin.json に name がありません" };
  }

  const files: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(all)) {
    if (path.startsWith(root)) files[path.slice(root.length)] = data;
  }

  const hooksJson = files["hooks/hooks.json"];
  if (!hooksJson) {
    return { ok: false, error: "hooks/hooks.json がありません(modには modules を持つ hooks/hooks.json が必要です)" };
  }
  let modulesRaw: unknown;
  try {
    modulesRaw = (JSON.parse(strFromU8(hooksJson)) as { modules?: unknown }).modules;
  } catch {
    return { ok: false, error: "hooks/hooks.json がJSONとして読めません" };
  }
  if (!Array.isArray(modulesRaw) || modulesRaw.length === 0 || !modulesRaw.every((m) => typeof m === "string")) {
    return { ok: false, error: 'hooks/hooks.json の "modules" に、フックモジュールへのパスを指定してください' };
  }

  const modules: string[] = [];
  for (const spec of modulesRaw as string[]) {
    const resolved = resolveModulePath(spec);
    if (!resolved || !SOURCE_EXT.test(resolved)) {
      return { ok: false, error: `modules のパスが不正です: ${spec}(.js/.mjs/.ts/.tsx などで、hooks/ から相対指定してください)` };
    }
    if (!files[resolved]) return { ok: false, error: `modules が指すファイルがZIPにありません: ${spec}` };
    modules.push(resolved);
  }

  return { ok: true, pkg: { root, files, manifest, modules } };
}

const CALL_RISK: Record<string, { level: "high" | "medium"; label: string }> = {
  "process.run": { level: "high", label: "外部プログラムをあなたの権限で実行" },
  "process.spawn": { level: "high", label: "外部プログラムをあなたの権限で起動" },
  "fs.write": { level: "high", label: "ファイルを書き込み" },
  "env.set": { level: "high", label: "環境変数を設定(Claude Codeと配下のコマンドに影響)" },
  "prompt.submit": { level: "high", label: "プロンプトを送信(あなたの言葉として送れる)" },
  "session.send": { level: "high", label: "他のセッションへメッセージを送信" },
  "fs.read": { level: "medium", label: "ファイルを読み取り" },
  "http.fetch": { level: "medium", label: "ネットワーク通信" },
  "env.get": { level: "medium", label: "環境変数を読み取り(APIキー等を含み得る)" },
  "settings.read": { level: "medium", label: "設定ファイルを読み取り" },
  "mcp.call": { level: "medium", label: "MCPツールを呼び出し" },
  "model.complete": { level: "medium", label: "モデルを呼び出し(利用枠を消費)" },
  "model.fork": { level: "medium", label: "モデルを呼び出し(利用枠を消費)" },
  "model.classify": { level: "medium", label: "モデルを呼び出し(利用枠を消費)" },
  "tool.call": { level: "medium", label: "ツールを実行" },
  "agent.spawn": { level: "medium", label: "サブエージェントを起動" },
  "session.messages": { level: "medium", label: "会話履歴を読み取り" },
};

const HOOK_RISK: Record<string, { level: "high" | "medium"; label: string }> = {
  "tool.check": { level: "high", label: "権限確認の前にツール呼び出しを承認・拒否できる" },
  "session.append": { level: "high", label: "保存前に会話の各行を書き換えられる" },
  "tool.call": { level: "medium", label: "すべてのツール呼び出しを見て、変更・拒否できる" },
  "prompt.submit": { level: "medium", label: "送信するすべてのプロンプトを見て、書き換えられる" },
  "prompt.compose": { level: "medium", label: "システムプロンプトを変更できる" },
  "plugin.register": { level: "medium", label: "他のModの読み込みを判定できる" },
};

function riskOfHook(name: string): { level: "high" | "medium"; label: string } | null {
  if (name.startsWith("classic.")) return { level: "medium", label: "設定フック相当のイベントを処理できる" };
  return HOOK_RISK[name] ?? null;
}

/**
 * フックモジュールのソースを静的に走査し、イベントと mods API 呼び出しを列挙する(`claude plugin validate` の hooks:/calls: 相当)。
 * ZIPに含まれるすべてのソースファイルを対象にする(tests/ や *.test.ts も、他のモジュールから import されれば実行されるため除外しない)。
 * 除外するのは、実行コードを持たない型宣言(*.d.ts。Claude Codeが読み込み時に書き出すAPI定義には全APIの例が載っている)のみ。
 * 正規表現による簡易スキャンであり、`const p = $.process` のような別名経由の呼び出しは検出できない(そのような書き方は
 * Claude Code自身が読み込みを拒否する)。結果は判断材料であって、安全性の保証ではない。
 */
export function scanMod(pkg: ModPackage): ModScan {
  const hooks = new Set<string>();
  const calls = new Set<string>();
  const envReads = new Set<string>();
  const envWrites = new Set<string>();

  for (const [path, data] of Object.entries(pkg.files)) {
    if (!SOURCE_EXT.test(path) || path.endsWith(".d.ts")) continue;
    const src = strFromU8(data);
    for (const m of src.matchAll(/\bon\(\s*(['"`])([\w.*-]+)\1/g)) hooks.add(m[2]);
    for (const m of src.matchAll(/\$\.([a-z]\w*)\.([a-zA-Z]\w*)/g)) calls.add(`${m[1]}.${m[2]}`);
    for (const m of src.matchAll(/\$\.env\.get\(\s*['"]([^'"]+)['"]/g)) envReads.add(m[1]);
    for (const m of src.matchAll(/\$\.env\.set\(\s*['"]([^'"]+)['"]/g)) envWrites.add(m[1]);
  }

  const findings: ModFinding[] = [];
  for (const name of [...calls].sort()) {
    const r = CALL_RISK[name];
    if (r) findings.push({ kind: "call", name: `$.${name}`, ...r });
  }
  for (const name of [...hooks].sort()) {
    const r = riskOfHook(name);
    if (r) findings.push({ kind: "hook", name, ...r });
  }

  const level: RiskLevel = findings.some((f) => f.level === "high") ? "high" : findings.length > 0 ? "medium" : "low";

  return {
    pluginName: pkg.manifest.name as string,
    modules: pkg.modules,
    hooks: [...hooks].sort(),
    calls: [...calls].sort(),
    envReads: [...envReads].sort(),
    envWrites: [...envWrites].sort(),
    findings,
    level,
  };
}

/**
 * マーケットプレイス配信用に、プラグインのルートをZIP直下に揃え、plugin.json の name/version/displayName を
 * サイトの識別子・バージョンに書き換えて再パッケージする(スキルの配信と同じく、インストール名はサイトが決める)。
 */
export function repackageMod(
  pkg: ModPackage,
  meta: { identifier: string; version: string; title: string },
): Uint8Array {
  const manifest = { ...pkg.manifest, name: meta.identifier, version: meta.version, displayName: meta.title };
  const files: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(pkg.files)) files[path] = data;
  files[MANIFEST_SUFFIX] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(files);
}
