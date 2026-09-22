import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import MarkdownEditor from "../components/MarkdownEditor";
import TagPicker from "../components/TagPicker";
import { BoxIcon, CheckIcon, ExternalLinkIcon, InfoIcon, SparkleIcon, StarIcon, TagIcon } from "../components/icons";
import { api, ApiError } from "../lib/api";
import { parseSkillMd } from "../lib/parseSkillMd";
import type { ItemType, Tag } from "../lib/types";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal";
const labelClass = "mb-1.5 block text-sm font-medium text-ink-secondary";

const TIPS = [
  "概要は100字以内で簡潔に(一覧カードにそのまま表示されます)",
  "詳細説明には、何ができるか・どんな場面で使うかを具体的に書くと伝わりやすくなります",
  "スキルはSKILL.md単体でも投稿できます(タイトル・概要が自動入力されます)",
  "適切なタグを選ぶと、他の人が見つけやすくなります",
];

const EXTERNAL_TIPS = [
  "GitHubのURLを入力して「自動取得」を押すと、タイトル・概要・作者・ライセンスを取得できます(空欄の項目のみ入力されます)",
  "自作物ではなく、既に公開されているOSS等を紹介する投稿です",
  "著作権・ライセンスは紹介元の作者に帰属します。詳細説明に使い方や注目ポイントを書くと伝わりやすくなります",
];

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function PostItemPage() {
  const navigate = useNavigate();

  const [type, setType] = useState<ItemType>("skill");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceAuthor, setSourceAuthor] = useState("");
  const [license, setLicense] = useState("");
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [fetchMetaError, setFetchMetaError] = useState<string | null>(null);
  const [fetchedStars, setFetchedStars] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    api.tags
      .list()
      .then((res) => setTags(res.tags))
      .catch(() => {
        /* タグ取得に失敗しても投稿自体は継続できる */
      });
  }, []);

  async function handleFileChange(f: File | null) {
    setFile(f);
    setAutoFilled(false);

    if (!f || !f.name.toLowerCase().endsWith(".md")) return;

    try {
      const text = await f.text();
      const parsed = parseSkillMd(text);
      let filled = false;

      // 既に手入力された内容は上書きしない(空欄のみ自動入力)
      if (parsed.title && !title.trim()) {
        setTitle(parsed.title);
        filled = true;
      }
      if (parsed.summary && !summary.trim()) {
        setSummary(parsed.summary);
        filled = true;
      }
      if (parsed.description && !description.trim()) {
        setDescription(parsed.description);
        filled = true;
      }
      if (parsed.body && !body.trim()) {
        setBody(parsed.body);
        filled = true;
      }
      setAutoFilled(filled);
    } catch {
      // 読み取り・解析に失敗しても手動入力にフォールバックするだけなので無視する
    }
  }

  async function handleAutoFetch() {
    setFetchMetaError(null);
    setFetchedStars(null);
    if (!sourceUrl.trim() || !isHttpUrl(sourceUrl.trim())) {
      setFetchMetaError("有効なGitHubのURLを入力してください");
      return;
    }

    setFetchingMeta(true);
    try {
      const meta = await api.items.fetchMetadata(sourceUrl.trim());
      let filled = false;

      // 既に手入力された内容は上書きしない(空欄のみ自動入力)
      if (meta.title && !title.trim()) {
        setTitle(meta.title);
        filled = true;
      }
      if (meta.description && !summary.trim()) {
        setSummary(meta.description.slice(0, 200));
        filled = true;
      }
      if (meta.author && !sourceAuthor.trim()) {
        setSourceAuthor(meta.author);
        filled = true;
      }
      if (meta.license && !license.trim()) {
        setLicense(meta.license);
        filled = true;
      }
      setFetchedStars(meta.stars);
      setAutoFilled(filled);
    } catch (err) {
      setFetchMetaError(err instanceof ApiError ? err.message : "メタデータの取得に失敗しました");
    } finally {
      setFetchingMeta(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    if (type === "prompt" && !body.trim()) {
      setError("プロンプト本文を入力してください");
      return;
    }
    if (type === "skill" && !file) {
      setError("スキル資産のファイル(.zip または SKILL.md)を選択してください");
      return;
    }
    if (type === "external" && !isHttpUrl(sourceUrl.trim())) {
      setError("有効な紹介先URLを入力してください");
      return;
    }

    setSubmitting(true);
    try {
      let created;
      if (type === "skill") {
        const fd = new FormData();
        fd.set("type", type);
        fd.set("title", title);
        fd.set("summary", summary);
        fd.set("description", description);
        fd.set("body", body);
        fd.set("tagIds", JSON.stringify(selectedTagIds));
        if (file) fd.set("file", file);
        created = await api.items.create(fd);
      } else if (type === "external") {
        created = await api.items.create({
          type,
          title,
          summary,
          description,
          sourceUrl: sourceUrl.trim(),
          sourceAuthor,
          license,
          stars: fetchedStars ?? undefined,
          tagIds: JSON.stringify(selectedTagIds),
        });
      } else {
        created = await api.items.create({
          type,
          title,
          summary,
          description,
          body,
          tagIds: JSON.stringify(selectedTagIds),
        });
      }
      navigate(`/items/${created.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  const accentText = type === "skill" ? "text-skill" : type === "prompt" ? "text-prompt" : "text-external";
  const accentBg = type === "skill" ? "bg-skill" : type === "prompt" ? "bg-prompt" : "bg-external";

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-6 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-onaccent ${accentBg}`}>
          {type === "skill" ? (
            <BoxIcon className="h-4.5 w-4.5" />
          ) : type === "prompt" ? (
            <SparkleIcon className="h-4 w-4" />
          ) : (
            <ExternalLinkIcon className="h-4 w-4" />
          )}
        </div>
        <div>
          <p className={`font-display text-xs font-semibold uppercase tracking-wide ${accentText}`}>新規投稿</p>
          <h1 className="font-display text-xl font-bold text-ink">あなたの知識・ノウハウを共有しましょう</h1>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div>
              <label className={labelClass}>種別</label>
              <div className="flex overflow-hidden rounded-lg border border-border w-fit">
                {(["skill", "prompt", "external"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setType(v)}
                    className={`px-4 py-1.5 text-sm font-semibold font-display transition-colors ${
                      type === v ? "bg-active text-active-text" : "bg-surface text-ink-secondary hover:bg-surface-2"
                    }`}
                  >
                    {v === "skill" ? "スキル(再利用可能な機能)" : v === "prompt" ? "プロンプト(コピー用)" : "OSS紹介(外部リンク)"}
                  </button>
                ))}
              </div>
            </div>

            {type === "external" && (
              <div className="rounded-lg border border-warn-border bg-warn-bg p-4">
                <label className={labelClass}>紹介先URL(GitHub等) *</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => {
                      setSourceUrl(e.target.value);
                      setFetchMetaError(null);
                    }}
                    required
                    placeholder="https://github.com/owner/repo"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => void handleAutoFetch()}
                    disabled={fetchingMeta || !sourceUrl.trim()}
                    className="shrink-0 rounded-md border border-external/40 bg-surface px-3 py-2 text-sm font-medium text-external hover:bg-external-dim disabled:opacity-50"
                  >
                    {fetchingMeta ? "取得中..." : "自動取得"}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-ink-secondary">
                  GitHubのURLを入力して自動取得を押すと、タイトル・概要・作者・ライセンスを取得できます(現在はGitHubのみ対応)。
                </p>
                {fetchMetaError && <p className="mt-1.5 text-xs text-red-500">{fetchMetaError}</p>}
                {fetchedStars !== null && !fetchMetaError && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <StarIcon filled className="h-3.5 w-3.5" />
                    取得成功(★{fetchedStars.toLocaleString()})。空欄だった項目に自動入力しました。
                  </p>
                )}

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>元の作者/組織</label>
                    <input
                      type="text"
                      value={sourceAuthor}
                      onChange={(e) => setSourceAuthor(e.target.value)}
                      placeholder="例: anthropics"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>ライセンス</label>
                    <input
                      type="text"
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                      placeholder="例: MIT"
                      className={inputClass}
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                  これは第三者が公開しているOSS等の紹介投稿です。著作権・ライセンスは紹介元の作者に帰属します。
                </p>
              </div>
            )}

            <div>
              <label className={labelClass}>タイトル *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                placeholder="例: PRレビューチェックリスト"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>概要(一覧カードに表示)</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={200}
                placeholder="どんな時に使えるか、一言で"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                詳細説明 <span className="font-normal text-ink-secondary">(Markdown対応)</span>
              </label>
              <MarkdownEditor
                value={description}
                onChange={setDescription}
                rows={5}
                textareaClassName={inputClass}
              />
            </div>

            {type === "skill" ? (
              <>
                <div>
                  <label className={labelClass}>スキル資産(.zip または SKILL.md) *</label>
                  <input
                    type="file"
                    accept=".zip,.md"
                    onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-secondary hover:file:bg-border"
                  />
                  <p className="mt-1.5 text-xs text-ink-secondary">
                    最大25MBまで。ZIP一式でもSKILL.md単体でも投稿できます。npx skills add 互換の配布は将来対応予定です。
                  </p>
                  {autoFilled && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckIcon className="h-3.5 w-3.5" />
                      SKILL.mdの内容からタイトル・概要等を自動入力しました(空欄だった項目のみ)。
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>使い方メモ(任意)</label>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={inputClass} />
                </div>
              </>
            ) : type === "prompt" ? (
              <div>
                <label className={labelClass}>プロンプト本文 *</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  required
                  className={`font-mono ${inputClass}`}
                />
              </div>
            ) : null}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 border-t border-border pt-5">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-cta px-5 py-2 text-sm font-semibold text-cta-text shadow-sm hover:bg-cta-hover disabled:opacity-50"
              >
                {submitting ? "投稿中..." : "投稿する"}
              </button>
            </div>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                <InfoIcon className="h-3.5 w-3.5" />
                入力のヒント
              </p>
              <ul className="flex flex-col gap-2.5">
                {(type === "external" ? EXTERNAL_TIPS : TIPS).map((tip) => (
                  <li key={tip} className="flex gap-2 text-xs leading-relaxed text-ink-secondary">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                <TagIcon className="h-3.5 w-3.5" />
                タグ
              </p>
              <TagPicker
                tags={tags}
                selected={selectedTagIds}
                onChange={setSelectedTagIds}
                onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
                onTagDeleted={(tagId) => setTags((prev) => prev.filter((t) => t.id !== tagId))}
              />
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
