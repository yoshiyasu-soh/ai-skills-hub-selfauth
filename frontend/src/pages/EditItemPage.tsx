import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MarkdownEditor from "../components/MarkdownEditor";
import TagPicker from "../components/TagPicker";
import { BoxIcon, CheckIcon, ExternalLinkIcon, InfoIcon, SparkleIcon, TagIcon } from "../components/icons";
import { api } from "../lib/api";
import { parseSkillMd } from "../lib/parseSkillMd";
import type { Item, Tag } from "../lib/types";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal";
const labelClass = "mb-1.5 block text-sm font-medium text-ink-secondary";

const TIPS = [
  "プロンプト本文・添付ファイルを実際に更新すると、自動的にバージョンが上がり、DL・コピー・お気に入り登録済みのユーザーに更新が通知されます(タグ・説明文だけの変更ではバージョンは変わりません)",
  "ファイルは差し替える場合のみ選択してください(未選択なら現在のファイルを維持します)",
  "概要は一覧カードにそのまま表示されます",
];

const EXTERNAL_TIPS = [
  "紹介先URL・作者・ライセンスを変更すると、お気に入り登録済みのユーザーに更新が通知されます",
  "著作権・ライセンスは紹介元の作者に帰属します",
];

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function EditItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.items.get(id), api.tags.list()])
      .then(([itemRes, tagsRes]) => {
        const it = itemRes.item;
        if (!it.isOwner) {
          setLoadError("この投稿を編集する権限がありません");
          return;
        }
        setItem(it);
        setTitle(it.title);
        setSummary(it.summary);
        setDescription(it.description);
        setBody(it.body);
        setSourceUrl(it.sourceUrl ?? "");
        setSourceAuthor(it.sourceAuthor ?? "");
        setLicense(it.license ?? "");
        setSelectedTagIds(it.tags.map((t) => t.id));
        setTags(tagsRes.tags);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleFileChange(f: File | null) {
    setFile(f);
    setAutoFilled(false);

    if (!f || !f.name.toLowerCase().endsWith(".md")) return;

    try {
      const text = await f.text();
      const parsed = parseSkillMd(text);
      let filled = false;

      // 既に入力済みの内容は上書きしない(空欄のみ自動入力)
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    setError(null);

    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    if (item.type === "prompt" && !body.trim()) {
      setError("プロンプト本文を入力してください");
      return;
    }
    if (item.type === "external" && !isHttpUrl(sourceUrl.trim())) {
      setError("有効な紹介先URLを入力してください");
      return;
    }

    setSubmitting(true);
    try {
      let updated;
      if (item.type === "skill") {
        const fd = new FormData();
        fd.set("title", title);
        fd.set("summary", summary);
        fd.set("description", description);
        fd.set("body", body);
        fd.set("tagIds", JSON.stringify(selectedTagIds));
        if (file) fd.set("file", file);
        updated = await api.items.update(item.id, fd);
      } else if (item.type === "external") {
        updated = await api.items.update(item.id, {
          title,
          summary,
          description,
          sourceUrl: sourceUrl.trim(),
          sourceAuthor,
          license,
          tagIds: JSON.stringify(selectedTagIds),
        });
      } else {
        updated = await api.items.update(item.id, {
          title,
          summary,
          description,
          body,
          tagIds: JSON.stringify(selectedTagIds),
        });
      }
      navigate(`/items/${updated.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-ink-secondary">読み込み中...</p>;
  if (loadError) return <p className="text-sm text-red-500">{loadError}</p>;
  if (!item) return null;

  const isSkill = item.type === "skill";
  const isExternal = item.type === "external";
  const accentText = isSkill ? "text-skill" : isExternal ? "text-external" : "text-prompt";
  const accentBg = isSkill ? "bg-skill" : isExternal ? "bg-external" : "bg-prompt";

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-6 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-onaccent ${accentBg}`}>
          {isSkill ? (
            <BoxIcon className="h-4.5 w-4.5" />
          ) : isExternal ? (
            <ExternalLinkIcon className="h-4 w-4" />
          ) : (
            <SparkleIcon className="h-4 w-4" />
          )}
        </div>
        <div>
          <p className={`font-display text-xs font-semibold uppercase tracking-wide ${accentText}`}>編集</p>
          <h1 className="font-display text-xl font-bold text-ink">{item.title}</h1>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 shadow-card">
            {isExternal && (
              <div className="rounded-lg border border-warn-border bg-warn-bg p-4">
                <label className={labelClass}>紹介先URL(GitHub等) *</label>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  required
                  placeholder="https://github.com/owner/repo"
                  className={inputClass}
                />
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
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>概要</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={200}
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

            {!isExternal && (
              <div>
                <label className={labelClass}>バージョン</label>
                <p className="font-mono text-sm text-ink-secondary">
                  v{item.version}
                  <span className="ml-2 font-sans text-xs text-ink-secondary">
                    ({isSkill ? "添付ファイル" : "本文"}を更新すると自動的に上がります)
                  </span>
                </p>
              </div>
            )}

            {isSkill ? (
              <>
                <div>
                  <label className={labelClass}>スキル資産(.zip または SKILL.md) — 差し替える場合のみ選択</label>
                  <input
                    type="file"
                    accept=".zip,.md"
                    onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-secondary hover:file:bg-border"
                  />
                  {item.fileName && (
                    <p className="mt-1.5 text-xs text-ink-secondary">
                      現在のファイル: <span className="font-mono">{item.fileName}</span>
                    </p>
                  )}
                  {autoFilled && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckIcon className="h-3.5 w-3.5" />
                      SKILL.mdの内容から空欄の項目を自動入力しました。
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>使い方メモ</label>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={inputClass} />
                </div>
              </>
            ) : isExternal ? null : (
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
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 border-t border-border pt-5">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-cta px-5 py-2 text-sm font-semibold text-cta-text shadow-sm hover:bg-cta-hover disabled:opacity-50"
              >
                {submitting ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                <InfoIcon className="h-3.5 w-3.5" />
                編集のヒント
              </p>
              <ul className="flex flex-col gap-2.5">
                {(isExternal ? EXTERNAL_TIPS : TIPS).map((tip) => (
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
