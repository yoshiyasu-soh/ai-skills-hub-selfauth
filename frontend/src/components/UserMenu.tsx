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
        className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-slate-100 sm:flex"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600">
          {user.displayName.slice(0, 1)}
        </span>
        <span className="font-medium text-slate-700">{user.displayName}</span>
        <ChevronDownIcon className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 animate-fade-in rounded-xl border border-slate-200 bg-white py-1.5 shadow-popover">
          <Link
            to={`/users/${encodeURIComponent(user.email)}`}
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            プロフィール
          </Link>
          <Link
            to="/settings/tokens"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            アクセストークン
          </Link>
          <div className="my-1.5 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="block w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
