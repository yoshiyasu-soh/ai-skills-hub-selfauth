import { Navigate, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import LogoMark from "./components/LogoMark";
import EditItemPage from "./pages/EditItemPage";
import FavoritesPage from "./pages/FavoritesPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import GuidePage from "./pages/GuidePage";
import HomePage from "./pages/HomePage";
import ItemDetailPage from "./pages/ItemDetailPage";
import LoginPage from "./pages/LoginPage";
import McpGuidePage from "./pages/McpGuidePage";
import PostItemPage from "./pages/PostItemPage";
import RankingPage from "./pages/RankingPage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import UserProfilePage from "./pages/UserProfilePage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import { useUser } from "./lib/UserContext";

export default function App() {
  const { user, loading, error } = useUser();

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <LogoMark className="h-9 w-9 animate-pulse" />
        <p className="text-sm text-slate-400">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <LogoMark className="mb-2 h-9 w-9 opacity-60" />
        <p className="text-lg font-semibold text-slate-900">認証情報の取得に失敗しました</p>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/items/:id" element={<ItemDetailPage />} />
          <Route path="/items/:id/edit" element={<EditItemPage />} />
          <Route path="/post" element={<PostItemPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/users/:email" element={<UserProfilePage />} />
          <Route path="/guide/skills" element={<GuidePage topic="skill" />} />
          <Route path="/guide/prompts" element={<GuidePage topic="prompt" />} />
          <Route path="/guide/mcp" element={<McpGuidePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
