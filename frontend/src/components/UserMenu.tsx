import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../lib/UserContext";
import { ChevronDownIcon } from "./icons";

export default function UserMenu() {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/login");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-surface-2 sm:flex"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-avatar-bg text-[11px] font-semibold text-avatar-fg">
          {user.displayName.slice(0, 1)}
        </span>
        <span className="font-medium text-ink-secondary">{user.displayName}</span>
        <ChevronDownIcon className={`h-3.5 w-3.5 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 animate-fade-in rounded-xl border border-border bg-surface py-1.5 shadow-popover">
          <Link
            to={`/users/${encodeURIComponent(user.email)}`}
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2 text-sm text-ink-secondary hover:bg-surface-2"
          >
            プロフィール
          </Link>
          <Link
            to="/settings/tokens"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2 text-sm text-ink-secondary hover:bg-surface-2"
          >
            アクセストークン
          </Link>
          <div className="my-1.5 border-t border-border" />
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="block w-full px-3.5 py-2 text-left text-sm text-ink-secondary hover:bg-surface-2"
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
