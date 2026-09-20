import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDateTime } from "../lib/formatDate";
import { useToast } from "../lib/ToastContext";
import type { Comment } from "../lib/types";
import { ChatIcon } from "./icons";

interface Props {
  itemId: string;
}

const MAX_COMMENT_LENGTH = 2000;

export default function CommentSection({ itemId }: Props) {
  const { showToast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.items.comments
      .list(itemId)
      .then((res) => setComments(res.comments))
      .catch((err) => showToast(err instanceof Error ? err.message : "コメントの取得に失敗しました"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await api.items.comments.create(itemId, trimmed);
      setComments((prev) => [...prev, res.comment]);
      setBody("");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "コメントの投稿に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: number) {
    if (!window.confirm("このコメントを削除しますか?")) return;
    try {
      await api.items.comments.remove(itemId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center gap-1.5 border-b border-slate-200 px-5 py-3">
        <ChatIcon className="h-4 w-4 text-slate-400" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          コメント{comments.length > 0 && ` (${comments.length})`}
        </h2>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {loading ? (
          <p className="text-sm text-slate-400">読み込み中...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-400">まだコメントはありません。</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600">
                  {comment.authorName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/users/${encodeURIComponent(comment.authorEmail)}`}
                      className="text-sm font-semibold text-slate-800 hover:underline"
                    >
                      {comment.authorName}
                    </Link>
                    <span className="text-xs text-slate-400">{formatDateTime(comment.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{comment.body}</p>
                </div>
                {comment.canDelete && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(comment.id)}
                    className="shrink-0 self-start text-xs text-slate-400 hover:text-red-600"
                  >
                    削除
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-slate-100 pt-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_COMMENT_LENGTH}
            rows={3}
            placeholder="コメントを入力..."
            className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="self-end rounded-md bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "投稿中..." : "コメントする"}
          </button>
        </form>
      </div>
    </section>
  );
}
