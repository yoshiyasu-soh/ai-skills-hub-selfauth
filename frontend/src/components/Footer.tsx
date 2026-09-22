import { Link } from "react-router-dom";
import LogoMark from "./LogoMark";

const linkClass = "text-sm text-ink-secondary transition-colors hover:text-ink";

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-border bg-footer">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-[1.3fr,1fr,1fr] sm:px-6 lg:px-10">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-bold text-ink font-display">
            <LogoMark className="h-6 w-6" />
            <span>AI Skills Hub</span>
          </div>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-ink-secondary">
            Claude Code のスキル・プロンプトを共有するためのサイトです。
          </p>
        </div>
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">ドキュメント</p>
          <ul className="flex flex-col gap-2">
            <li>
              <Link to="/guide" className={linkClass}>
                使い方ガイド
              </Link>
            </li>
            <li>
              <Link to="/guide/mcp" className={linkClass}>
                MCP連携
              </Link>
            </li>
            <li>
              <Link to="/guide#faq" className={linkClass}>
                よくある質問
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">アカウント</p>
          <ul className="flex flex-col gap-2">
            <li>
              <Link to="/settings/profile" className={linkClass}>
                プロフィール編集
              </Link>
            </li>
            <li>
              <Link to="/settings/tokens" className={linkClass}>
                アクセストークン管理
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-ink-muted sm:px-6 lg:px-10">
        &copy; {new Date().getFullYear()} AI Skills Hub
      </div>
    </footer>
  );
}
