import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { User } from "../lib/types";

export default function UserProfilePage() {
  const { email } = useParams<{ email: string }>();

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    setError(null);
    api.users
      .get(email)
      .then((res) => setProfile(res.user))
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [email]);

  if (loading) return <p className="text-sm text-slate-400">読み込み中...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
          {profile.displayName.slice(0, 1)}
        </span>
        <div>
          <h1 className="text-xl font-bold leading-tight text-slate-900">{profile.displayName}</h1>
          <p className="text-sm text-slate-400">{profile.email}</p>
        </div>
      </div>
    </div>
  );
}
