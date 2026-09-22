import { NavLink } from "react-router-dom";
import { useUser } from "../lib/UserContext";
import LogoMark from "./LogoMark";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
    isActive
      ? "text-ink shadow-[inset_0_-2px_0_theme(colors.signal)]"
      : "text-ink-secondary hover:bg-surface-2 hover:text-ink"
  }`;

export default function Header() {
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-header backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-10">
        <div className="flex items-center gap-4 sm:gap-6">
          <NavLink to="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-ink font-display">
            <LogoMark className="h-7 w-7 shrink-0" />
            <span className="hidden sm:inline">AI Skills Hub</span>
          </NavLink>
          <nav className="flex items-center gap-0.5">
            <NavLink to="/" end className={navLinkClass}>
              一覧
            </NavLink>
            <NavLink to="/ranking" className={navLinkClass}>
              ランキング
            </NavLink>
            <NavLink to="/favorites" className={navLinkClass}>
              お気に入り
            </NavLink>
            <NavLink to="/guide/mcp" className={navLinkClass}>
              MCP連携
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <NavLink
            to="/post"
            className="rounded-md bg-cta px-3.5 py-1.5 text-sm font-semibold text-cta-text shadow-sm transition-colors hover:bg-cta-hover font-display"
          >
            + 投稿する
          </NavLink>
          <div className="flex items-center gap-1.5 border-l border-border pl-3">
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-1 text-sm text-ink-secondary">
                <NotificationBell />
                <UserMenu />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
