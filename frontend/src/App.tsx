import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Footer from "./components/Footer";
import Header from "./components/Header";
import LogoMark from "./components/LogoMark";
import ScrollToTop from "./components/ScrollToTop";
import { useUser } from "./lib/UserContext";

const ApiTokensPage = lazy(() => import("./pages/ApiTokensPage"));
const ClaudePluginGuidePage = lazy(() => import("./pages/ClaudePluginGuidePage"));
const DocsPage = lazy(() => import("./pages/DocsPage"));
const EditItemPage = lazy(() => import("./pages/EditItemPage"));
const EditProfilePage = lazy(() => import("./pages/EditProfilePage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const GuidePage = lazy(() => import("./pages/GuidePage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const ItemDetailPage = lazy(() => import("./pages/ItemDetailPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const McpGuidePage = lazy(() => import("./pages/McpGuidePage"));
const PostItemPage = lazy(() => import("./pages/PostItemPage"));
const RankingPage = lazy(() => import("./pages/RankingPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));

function PageFallback() {
  return <p className="py-10 text-center text-sm text-ink-secondary">読み込み中...</p>;
}

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
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
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
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/items/:id" element={<ItemDetailPage />} />
            <Route path="/items/:id/edit" element={<EditItemPage />} />
            <Route path="/post" element={<PostItemPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/users/:id" element={<UserProfilePage />} />
            <Route path="/settings/profile" element={<EditProfilePage />} />
            <Route path="/settings/tokens" element={<ApiTokensPage />} />
            <Route path="/guide" element={<DocsPage />} />
            <Route path="/guide/skills" element={<GuidePage topic="skill" />} />
            <Route path="/guide/prompts" element={<GuidePage topic="prompt" />} />
            <Route path="/guide/agents" element={<GuidePage topic="agent" />} />
            <Route path="/guide/mods" element={<GuidePage topic="mod" />} />
            <Route path="/guide/external" element={<GuidePage topic="external" />} />
            <Route path="/guide/mcp" element={<McpGuidePage />} />
            <Route path="/guide/claude-plugin" element={<ClaudePluginGuidePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
