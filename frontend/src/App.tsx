import { Navigate, Route, Routes } from "react-router-dom";
import Footer from "./components/Footer";
import Header from "./components/Header";
import LogoMark from "./components/LogoMark";
import ScrollToTop from "./components/ScrollToTop";
import ApiTokensPage from "./pages/ApiTokensPage";
import DocsPage from "./pages/DocsPage";
import EditItemPage from "./pages/EditItemPage";
import EditProfilePage from "./pages/EditProfilePage";
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
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg">
        <LogoMark className="h-9 w-9 animate-pulse" />
        <p className="text-sm text-ink-secondary">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg px-4 text-center">
        <LogoMark className="mb-2 h-9 w-9 opacity-60" />
        <p className="text-lg font-semibold text-ink font-display">認証情報の取得に失敗しました</p>
        <p className="text-sm text-ink-secondary">{error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <ScrollToTop />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-cta focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-cta-text"
      >
        本文へスキップ
      </a>
      <Header />
      <main id="main-content" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/items/:id" element={<ItemDetailPage />} />
          <Route path="/items/:id/edit" element={<EditItemPage />} />
          <Route path="/post" element={<PostItemPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/users/:email" element={<UserProfilePage />} />
          <Route path="/settings/profile" element={<EditProfilePage />} />
          <Route path="/settings/tokens" element={<ApiTokensPage />} />
          <Route path="/guide" element={<DocsPage />} />
          <Route path="/guide/skills" element={<GuidePage topic="skill" />} />
          <Route path="/guide/prompts" element={<GuidePage topic="prompt" />} />
          <Route path="/guide/external" element={<GuidePage topic="external" />} />
          <Route path="/guide/mcp" element={<McpGuidePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
