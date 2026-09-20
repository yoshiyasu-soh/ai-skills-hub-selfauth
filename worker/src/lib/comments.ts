export interface CommentDTO {
  id: number;
  itemId: string;
  authorEmail: string;
  authorName: string;
  body: string;
  createdAt: string;
  /** 投稿者本人、またはコメント先アイテムの投稿者(モデレーション権限)なら削除できる */
  canDelete: boolean;
}

export interface CommentRow {
  id: number;
  item_id: string;
  author_email: string;
  author_display_name: string;
  body: string;
  created_at: string;
}

export function toCommentDTO(row: CommentRow, viewerEmail: string, itemAuthorEmail: string): CommentDTO {
  return {
    id: row.id,
    itemId: row.item_id,
    authorEmail: row.author_email,
    authorName: row.author_display_name,
    body: row.body,
    createdAt: row.created_at,
    canDelete: row.author_email === viewerEmail || itemAuthorEmail === viewerEmail,
  };
}
