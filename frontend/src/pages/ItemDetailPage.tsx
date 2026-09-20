import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  BoxIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  SparkleIcon,
  StarIcon,
  UserIcon,
} from "../components/icons";
import CommentSection from "../components/CommentSection";
import VersionHistorySection from "../components/VersionHistorySection";
import MarkdownContent from "../components/MarkdownContent";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/formatDate";
import { formatCompactNumber } from "../lib/formatNumber";
import { installDirName } from "../lib/installName";
import { useToast } from "../lib/ToastContext";
import type { Item } from "../lib/types";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type InstallOs = "unix" | "windows";

// Claude Codeの `~/.claude/skills/<name>/` にワンライナーで取得・配置するコマンドを組み立てる。
// アクセストークン自体はコマンド中に埋め込まず、環境変数への代入をユーザー自身に行ってもらう。
// bash系(macOS/Linux/Git Bash)とWindows PowerShellでコマンド体系が全く異なるため、OSごとに別々に組み立てる。
function buildInstallCommand(item: Item, os: InstallOs): string {
  const url = `${window.location.origin}${api.items.downloadUrl(item.id)}`;
  const name = installDirName(item.title, item.id.slice(0, 8));
  const isMd = (item.fileName ?? "").toLowerCase().endsWith(".md");

  if (os === "windows") {
    const dir = `$env:USERPROFILE\\.claude\\skills\\${name}`;
    const headers = `@{ Authorization = "Bearer $env:AI_SKILLS_HUB_TOKEN" }`;
    if (isMd) {
      return `New-Item -ItemType Directory -Force -Path "${dir}" | Out-Null; Invoke-WebRequest -Uri "${url}" -Headers ${headers} -OutFile "${dir}\\SKILL.md"`;
    }
    const zip = `$env:TEMP\\${name}.zip`;
    return `Invoke-WebRequest -Uri "${url}" -Headers ${headers} -OutFile "${zip}"; New-Item -ItemType Directory -Force -Path "${dir}" | Out-Null; Expand-Archive -Path "${zip}" -DestinationPath "${dir}" -Force; Remove-Item "${zip}"`;
  }

  const dir = `~/.claude/skills/${name}`;
  const auth = `-H "Authorization: Bearer $AI_SKILLS_HUB_TOKEN"`;
  if (isMd) {
    return `mkdir -p ${dir} && curl -fsSL ${auth} "${url}" -o ${dir}/SKILL.md`;
  }
  return `curl -fsSL ${auth} "${url}" -o /tmp/${name}.zip && mkdir -p ${dir} && unzip -o /tmp/${name}.zip -d ${dir} && rm /tmp/${name}.zip`;
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  // 一覧(カード)から遷移した場合は、そこで選んでいた絞り込み・ソート・ページを保ったまま戻れるように
  // ItemCard側でstateに戻り先URLを積んでおいてもらう。無ければ("/一覧"直リンク等)一覧トップへ。
  const backTo = (location.state as { from?: string } | null)?.from ?? "/";

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contentTab, setContentTab] = useState<"description" | "body" | "comments" | "history">("description");
  const [commentCount, setCommentCount] = useState(0);
  const [versionCount, setVersionCount] = useState(0);
  const [installOs, setInstallOs] = useState<InstallOs>(() =>
    navigator.userAgent.includes("Windows") ? "windows" : "unix",
  );
  const [installCommandCopied, setInstallCommandCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.items
      .get(id)
      .then((res) => setItem(res.item))
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleToggleFavorite() {
    if (!item) return;
    const next = !item.isFavorited;
    setItem({ ...item, isFavorited: next, favoriteCount: item.favoriteCount + (next ? 1 : -1) });
    try {
      if (next) {
        await api.items.favorite(item.id);
      } else {
        await api.items.unfavorite(item.id);
      }
    } catch {
      showToast("お気に入りの更新に失敗しました");
    }
  }

  async function handleCopy() {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.body);
      showToast("プロンプトをクリップボードにコピーしました");
    } catch {
      showToast("クリップボードへのコピーに失敗しました");
      return;
    }
    try {
      const res = await api.items.copy(item.id);
      setItem((prev) => (prev ? { ...prev, usageCount: res.usageCount } : prev));
    } catch {
      // カウント更新の失敗はユーザー操作をブロックしない
    }
  }

  async function handleOpenInClaude() {
    if (!item) return;
    const url = `https://claude.ai/new?q=${encodeURIComponent(item.body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      const res = await api.items.copy(item.id);
      setItem((prev) => (prev ? { ...prev, usageCount: res.usageCount } : prev));
    } catch {
      // カウント更新の失敗はユーザー操作をブロックしない
    }
  }

  async function handleVisit() {
    if (!item || !item.sourceUrl) return;
    window.open(item.sourceUrl, "_blank", "noopener,noreferrer");
    try {
      const res = await api.items.visit(item.id);
      setItem((prev) => (prev ? { ...prev, usageCount: res.usageCount } : prev));
    } catch {
      // カウント更新の失敗はユーザー操作をブロックしない
    }
  }

  function handleDownloadClick() {
    if (!item) return;
    // 実ダウンロードは <a href> のブラウザ標準遷移に任せているため、JS側はこの時点で
    // サーバーが実際にカウントしたか(投稿者本人・2回目以降のダウンロードは加算されない)を知る手段が無い。
    // ダウンロードリクエストがサーバーで完了する程度の時間を置いてから、実際の値を取得し直す。
    const targetId = item.id;
    setTimeout(() => {
      api.items
        .get(targetId)
        .then((res) => {
          setItem((prev) => (prev && prev.id === targetId ? { ...prev, usageCount: res.item.usageCount } : prev));
        })
        .catch(() => {
          // 再取得に失敗しても表示中の値をそのまま維持する
        });
    }, 1000);
  }

  async function handleCopyInstallCommand() {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(buildInstallCommand(item, installOs));
      setInstallCommandCopied(true);
      setTimeout(() => setInstallCommandCopied(false), 1500);
    } catch {
      showToast("クリップボードへのコピーに失敗しました");
    }
  }

  async function handleDelete() {
    if (!item) return;
    if (!window.confirm(`「${item.title}」を削除します。よろしいですか？`)) return;
    try {
      await api.items.remove(item.id);
      showToast("削除しました");
      navigate("/");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  if (loading) return <p className="text-sm text-slate-400">読み込み中...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!item) return <p className="text-sm text-slate-400">見つかりませんでした。</p>;

  const isSkill = item.type === "skill";
  const isExternal = item.type === "external";
  const accentText = isSkill ? "text-skill" : isExternal ? "text-amber-600" : "text-prompt";
  const accentBg = isSkill ? "bg-skill" : isExternal ? "bg-amber-500" : "bg-prompt";

  return (
    <div className="mx-auto max-w-[1280px]">
      <Link to={backTo} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeftIcon className="h-4 w-4" />
        一覧に戻る
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${accentBg}`}>
              {isSkill ? (
                <BoxIcon className="h-5 w-5" />
              ) : isExternal ? (
                <ExternalLinkIcon className="h-5 w-5" />
              ) : (
                <SparkleIcon className="h-5 w-5" />
              )}
            </div>
            <div>
              <span className="flex items-center gap-1.5 text-xs">
                <span className={`font-semibold uppercase tracking-wide ${accentText}`}>
                  {isSkill ? "Skill" : isExternal ? "OSS紹介" : "Prompt"}
                </span>
                {isExternal ? (
                  item.stars !== null && (
                    <span className="flex items-center gap-1 font-mono text-slate-400">
                      <StarIcon filled className="h-3.5 w-3.5 text-amber-400" />
                      {formatCompactNumber(item.stars)}
                    </span>
                  )
                ) : (
                  <span className="font-mono text-slate-400">v{item.version}</span>
                )}
              </span>
              <h1 className="text-2xl font-bold leading-tight text-slate-900">{item.title}</h1>
            </div>
          </div>
          {item.isOwner && (
            <div className="flex shrink-0 gap-2">
              <Link
                to={`/items/${item.id}/edit`}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                編集
              </Link>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                削除
              </button>
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <span className="flex items-center gap-1 tabular-nums">
            <UserIcon className="h-4 w-4 text-slate-400" />
            {item.usageCount} users
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <StarIcon filled={item.isFavorited} className={`h-4 w-4 ${item.isFavorited ? "text-amber-400" : "text-slate-300"}`} />
            {item.favoriteCount}
          </span>
          <Link
            to={`/users/${encodeURIComponent(item.authorEmail)}`}
            className="flex items-center gap-1.5 hover:underline"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
              {item.authorName.slice(0, 1)}
            </span>
            {item.authorName}
          </Link>
          <span>更新: {formatDateTime(item.updatedAt)}</span>
        </div>

        {item.hasUpdate && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            前回ご覧になってからバージョンが更新されています(v{item.version})。
          </div>
        )}

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                #{tag.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {item.summary && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-card">
              {item.summary}
            </div>
          )}

          {(() => {
            const hasDescription = Boolean(item.description);
            const hasBody = isSkill && Boolean(item.body);
            // コメントタブは常に存在する。バージョン履歴タブは外部紹介(OSS紹介)以外の
            // 全種別に存在する(外部紹介にはバージョンの概念自体を適用していないため)。
            // 選択中のタブが実際に表示可能かをここで検証する。
            const availableTabs = [
              ...(hasDescription ? (["description"] as const) : []),
              ...(hasBody ? (["body"] as const) : []),
              "comments" as const,
              ...(isExternal ? [] : (["history"] as const)),
            ];
            const activeTab = availableTabs.includes(contentTab) ? contentTab : availableTabs[0];

            return (
              <section className="rounded-xl border border-slate-200 bg-white shadow-card">
                <div className="flex border-b border-slate-200 px-2">
                  {hasDescription && (
                    <button
                      type="button"
                      onClick={() => setContentTab("description")}
                      className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                        activeTab === "description"
                          ? "border-b-2 border-brand-600 text-brand-700"
                          : "border-b-2 border-transparent text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      説明
                    </button>
                  )}
                  {hasBody && (
                    <button
                      type="button"
                      onClick={() => setContentTab("body")}
                      className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                        activeTab === "body"
                          ? "border-b-2 border-brand-600 text-brand-700"
                          : "border-b-2 border-transparent text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      使い方メモ
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setContentTab("comments")}
                    className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                      activeTab === "comments"
                        ? "border-b-2 border-brand-600 text-brand-700"
                        : "border-b-2 border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    コメント{commentCount > 0 && ` (${commentCount})`}
                  </button>
                  {!isExternal && (
                    <button
                      type="button"
                      onClick={() => setContentTab("history")}
                      className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                        activeTab === "history"
                          ? "border-b-2 border-brand-600 text-brand-700"
                          : "border-b-2 border-transparent text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      バージョン履歴{versionCount > 0 && ` (${versionCount})`}
                    </button>
                  )}
                </div>
                <div className="p-5">
                  {hasDescription && activeTab === "description" && (
                    <MarkdownContent
                      content={item.description}
                      className="prose-h1:text-base prose-h2:text-sm prose-h3:text-sm prose-headings:mt-4 prose-headings:mb-1.5 first:prose-headings:mt-0"
                    />
                  )}
                  {hasBody && activeTab === "body" && (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{item.body}</p>
                  )}
                  <div className={activeTab === "comments" ? "" : "hidden"}>
                    <CommentSection itemId={item.id} onCountChange={setCommentCount} />
                  </div>
                  {!isExternal && (
                    <div className={activeTab === "history" ? "" : "hidden"}>
                      <VersionHistorySection item={item} onCountChange={setVersionCount} />
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {item.type === "prompt" && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">プロンプト本文</h2>
              <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-sm leading-relaxed text-slate-100 shadow-card">
                {item.body}
              </pre>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            {isSkill ? (
              <a
                href={api.items.downloadUrl(item.id)}
                onClick={handleDownloadClick}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-skill px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-skill/90"
              >
                <DownloadIcon className="h-4 w-4" />
                ダウンロード
              </a>
            ) : isExternal ? (
              <button
                type="button"
                onClick={() => void handleVisit()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              >
                <ExternalLinkIcon className="h-4 w-4" />
                紹介元を見る
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-prompt px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-prompt/90"
                >
                  <CopyIcon className="h-4 w-4" />
                  クリップボードにコピー
                </button>
                <button
                  type="button"
                  onClick={() => void handleOpenInClaude()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-prompt/30 px-4 py-2.5 text-sm font-semibold text-prompt hover:bg-prompt/5"
                >
                  <ExternalLinkIcon className="h-4 w-4" />
                  claude.aiで新規チャットを開く
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => void handleToggleFavorite()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-amber-50 hover:text-amber-600"
            >
              <StarIcon filled={item.isFavorited} className={`h-4 w-4 ${item.isFavorited ? "text-amber-400" : "text-slate-300"}`} />
              {item.isFavorited ? "お気に入り済み" : "お気に入りに追加"}
            </button>
          </div>

          {isSkill && item.fileName && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">ファイル</p>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <FileIcon className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate font-mono">{item.fileName}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{formatBytes(item.fileSize)}</p>
            </div>
          )}

          {isSkill && item.fileName && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">インストールコマンド</p>
              <div className="mb-2 inline-flex rounded-md border border-slate-200 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setInstallOs("unix")}
                  className={`whitespace-nowrap rounded px-2 py-1 font-medium transition-colors ${
                    installOs === "unix" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  macOS / Linux
                </button>
                <button
                  type="button"
                  onClick={() => setInstallOs("windows")}
                  className={`whitespace-nowrap rounded px-2 py-1 font-medium transition-colors ${
                    installOs === "windows" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Windows
                </button>
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-slate-900 px-3.5 py-2.5">
                <code className="flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-slate-100">
                  {buildInstallCommand(item, installOs)}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyInstallCommand()}
                  className="shrink-0 rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
                >
                  {installCommandCopied ? "コピーしました" : "コピー"}
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {installOs === "windows" ? (
                  <>
                    <code className="font-mono">$env:AI_SKILLS_HUB_TOKEN</code> に自分の
                    <Link to="/settings/tokens" className="text-brand-600 hover:underline">
                      アクセストークン
                    </Link>
                    を設定してからPowerShellで実行すると、Claude Codeの
                    <code className="font-mono">%USERPROFILE%\.claude\skills\</code>
                    以下にこのスキルを直接取得できます(コマンドプロンプトではなくPowerShellで実行してください)。
                  </>
                ) : (
                  <>
                    <code className="font-mono">$AI_SKILLS_HUB_TOKEN</code> に自分の
                    <Link to="/settings/tokens" className="text-brand-600 hover:underline">
                      アクセストークン
                    </Link>
                    を設定してから実行すると、Claude Codeの<code className="font-mono">~/.claude/skills/</code>
                    以下にこのスキルを直接取得できます。
                  </>
                )}
              </p>
            </div>
          )}

          {isExternal && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">紹介元情報</p>
              <dl className="flex flex-col gap-2 text-sm text-slate-700">
                {item.sourceAuthor && (
                  <div>
                    <dt className="text-xs text-slate-400">元の作者/組織</dt>
                    <dd>{item.sourceAuthor}</dd>
                  </div>
                )}
                {item.license && (
                  <div>
                    <dt className="text-xs text-slate-400">ライセンス</dt>
                    <dd>{item.license}</dd>
                  </div>
                )}
                {item.stars !== null && (
                  <div>
                    <dt className="text-xs text-slate-400">GitHub Stars</dt>
                    <dd className="flex items-center gap-1">
                      <StarIcon filled className="h-3.5 w-3.5 text-amber-400" />
                      {item.stars.toLocaleString()}
                    </dd>
                  </div>
                )}
                {item.sourceUrl && (
                  <div>
                    <dt className="text-xs text-slate-400">紹介先URL</dt>
                    <dd className="truncate">
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-700 hover:underline"
                      >
                        {item.sourceUrl}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                これは第三者が公開しているOSS等の紹介です。著作権・ライセンスは紹介元の作者に帰属します。
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
