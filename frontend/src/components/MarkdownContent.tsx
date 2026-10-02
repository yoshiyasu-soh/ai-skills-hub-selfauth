import type { ReactNode } from "react";
import type { Element } from "hast";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
  className?: string;
  /** 原文の行番号(1始まり) → 見出しID。指定時のみh1〜h3にidを付ける */
  headingIds?: Record<number, string>;
}

/**
 * Markdown文字列をReact要素として描画する(dangerouslySetInnerHTMLは使わない)。
 * GitHub同様に本文中の生HTMLを反映するが、rehype-sanitize(デフォルトはGitHub準拠のスキーマ)で
 * script・イベントハンドラ・javascript:リンク等を除去するため、投稿本文経由のXSSは起きない。
 */
export default function MarkdownContent({ content, className = "", headingIds }: Props) {
  // 見出しに目次用のアンカーIDを付ける。原文の行番号 → ID の対応で引くため、同名見出しでも衝突しない。
  const headingComponents = headingIds
    ? Object.fromEntries(
        (["h1", "h2", "h3"] as const).map((Tag) => [
          Tag,
          ({ node, children }: { node?: Element; children?: ReactNode }) => (
            <Tag id={headingIds[node?.position?.start.line ?? -1]} tabIndex={-1} className="scroll-mt-4 focus:outline-none">
              {children}
            </Tag>
          ),
        ]),
      )
    : {};
  const components: Components = {
    ...headingComponents,
    a: ({ node: _node, ...props }) => <a {...props} rel="noopener noreferrer" />,
  };

  return (
    <div
      className={`prose prose-sm max-w-none prose-headings:font-display prose-headings:font-semibold prose-headings:text-ink prose-p:text-ink-secondary prose-strong:text-ink prose-a:text-ink prose-a:decoration-signal prose-a:decoration-2 prose-a:underline-offset-2 prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-surface-2 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal prose-code:text-ink prose-pre:border prose-pre:border-border prose-pre:bg-surface-2 prose-blockquote:border-border prose-blockquote:text-ink-secondary prose-hr:border-border prose-th:text-ink prose-td:text-ink-secondary prose-li:text-ink-secondary prose-img:rounded-lg [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-ink ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]} components={components}>{content}</ReactMarkdown>
    </div>
  );
}
