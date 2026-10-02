import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { DocFile } from "../../lib/doc/types";
import DocViewer from "./DocViewer";

/** 投稿(skill/agent)の資産ファイルを取得してビューアに渡す。閲覧ではDL数は加算されない */
export default function ItemDocumentSection({ itemId, title }: { itemId: string; title: string }) {
  const [files, setFiles] = useState<DocFile[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFiles(null);
    setError(false);
    api.items
      .files(itemId)
      .then((res) => !cancelled && setFiles(res.files))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  if (error) return <p className="text-sm text-danger">ドキュメントの取得に失敗しました</p>;
  if (!files) return <p className="text-sm text-ink-secondary">読み込み中...</p>;
  if (files.length === 0) return <p className="text-sm text-ink-secondary">表示できるドキュメントがありません</p>;
  return <DocViewer key={itemId} files={files} folderName={title} />;
}
