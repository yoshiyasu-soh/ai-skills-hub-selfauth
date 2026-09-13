import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { useUser } from "../lib/UserContext";

const EMPLOYEE_TYPE_OPTIONS = ["正社員", "契約社員", "業務委託", "派遣", "アルバイト・パート", "その他"];

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default function EditProfilePage() {
  const { user, refresh } = useUser();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [surname, setSurname] = useState(user?.surname ?? "");
  const [givenName, setGivenName] = useState(user?.givenName ?? "");
  const [companyName, setCompanyName] = useState(user?.companyName ?? "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [employeeType, setEmployeeType] = useState(user?.employeeType ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.updateProfile({
        displayName,
        givenName,
        surname,
        companyName,
        jobTitle,
        department,
        employeeType,
      });
      await refresh();
      navigate(`/users/${encodeURIComponent(user!.email)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">プロフィールを編集</h1>
        <Link to="/settings/tokens" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          MCP用アクセストークンの管理
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">表示名</span>
          <input
            required
            maxLength={100}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">姓</span>
            <input maxLength={100} value={surname} onChange={(e) => setSurname(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">名</span>
            <input maxLength={100} value={givenName} onChange={(e) => setGivenName(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">会社名</span>
          <input maxLength={100} value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">役職</span>
          <input maxLength={100} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">部署</span>
          <input maxLength={100} value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">従業員の種類</span>
          <select value={employeeType} onChange={(e) => setEmployeeType(e.target.value)} className={inputClass}>
            <option value="">未設定</option>
            {EMPLOYEE_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "保存中..." : "保存する"}
          </button>
        </div>
      </form>
    </div>
  );
}
