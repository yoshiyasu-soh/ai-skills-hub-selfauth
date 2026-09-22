import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
  className?: string;
}

/**
 * Markdown文字列をReact要素として描画する(dangerouslySetInnerHTMLは使わない)。
 * rehype-rawを組み込んでいないため、本文中に生HTMLを書いてもそのままテキストとして表示され、実行されない。
 */
export default function MarkdownContent({ content, className = "" }: Props) {
  return (
    <div
      className={`prose prose-sm max-w-none prose-headings:font-display prose-headings:font-semibold prose-headings:text-ink prose-p:text-ink-secondary prose-strong:text-ink prose-a:text-ink prose-a:decoration-signal prose-a:decoration-2 prose-a:underline-offset-2 prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-surface-2 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal prose-code:text-ink prose-pre:border prose-pre:border-border prose-pre:bg-surface-2 prose-blockquote:border-border prose-blockquote:text-ink-secondary prose-hr:border-border prose-th:text-ink prose-td:text-ink-secondary prose-li:text-ink-secondary prose-img:rounded-lg [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-ink ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
