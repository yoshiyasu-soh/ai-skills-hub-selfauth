import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useUser } from "../lib/UserContext";
import type { User } from "../lib/types";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-secondary">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value || <span className="text-ink-muted">未設定</span>}</dd>
    </div>
  );
}

export default function UserProfilePage() {
  const { email } = useParams<{ email: string }>();
  const { user: currentUser } = useUser();

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

  if (loading) return <p className="text-sm text-ink-secondary">読み込み中...</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!profile) return null;

  const isSelf = currentUser?.email === profile.email;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-lg font-semibold text-ink-secondary">
            {profile.displayName.slice(0, 1)}
          </span>
          <div>
            <h1 className="font-display text-xl font-bold leading-tight text-ink">{profile.displayName}</h1>
            <p className="text-sm text-ink-secondary">{profile.email}</p>
          </div>
        </div>
        {isSelf && (
          <Link
            to="/settings/profile"
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink-secondary hover:bg-surface-2"
          >
            編集する
          </Link>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <Field label="姓" value={profile.surname} />
        <Field label="名" value={profile.givenName} />
        <Field label="会社名" value={profile.companyName} />
        <Field label="役職" value={profile.jobTitle} />
        <Field label="部署" value={profile.department} />
        <Field label="従業員の種類" value={profile.employeeType} />
      </dl>
    </div>
  );
}
