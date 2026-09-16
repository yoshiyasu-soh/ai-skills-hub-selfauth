import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarsIcon,
  BoxIcon,
  ClockIcon,
  PlugIcon,
  SearchIcon,
  SparkleIcon,
  StarIcon,
  UserIcon,
} from "../components/icons";
import LogoMark from "../components/LogoMark";

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
      {n}
    </span>
  );
}

const FEATURES = [
  {
    icon: SearchIcon,
    title: "検索・タグ絞り込み",
    body: "タイトル・説明文の部分一致検索と、複数タグでのAND絞り込みができます。",
  },
  {
    icon: BarsIcon,
    title: "並び替え",
    body: "新着順・更新順・利用数順(DL/コピー)・お気に入り数順・名前順を切り替えられます。",
  },
  {
    icon: StarIcon,
    title: "お気に入り",
    body: "気になったスキル・プロンプトをお気に入り登録し、一覧からまとめて見返せます。",
  },
  {
    icon: ClockIcon,
    title: "ランキング",
    body: "累計・過去7日・過去30日のDL数/コピー数ランキングを確認できます。",
  },
  {
    icon: BoxIcon,
    title: "スキル投稿",
    body: "ZIP一式、またはSKILL.md単体でスキルを投稿できます。投稿者本人はいつでも編集・削除可能です。",
  },
  {
    icon: SparkleIcon,
    title: "プロンプト投稿",
    body: "テキストのプロンプトを投稿し、ワンクリックでコピーやclaude.aiへの受け渡しができます。",
  },
  {
    icon: PlugIcon,
    title: "MCP連携",
    body: "Claude Code / Claude Desktopから直接、検索・参照ができます。",
  },
  {
    icon: UserIcon,
    title: "プロフィール",
    body: "表示名・姓名・会社名・役職・部署・従業員の種類を自分で編集できます。",
  },
];

const FAQ = [
  {
    q: "パスワードを忘れてしまいました。",
    a: "ログイン画面の「パスワードをお忘れですか?」からメールアドレスを入力すると、再設定用のリンクが届きます。",
  },
  {
    q: "会員登録しようとするとエラーになります。",
    a: "登録可能なメールアドレスのドメインが制限されている場合があります。心当たりのある場合は管理者にご確認ください。",
  },
  {
    q: "投稿したスキル・プロンプトを直したい/消したい。",
    a: "投稿者本人であれば、詳細画面から編集・削除ができます。他の人の投稿は編集できません。",
  },
  {
    q: "MCP経由でうまく接続できません。",
    a: (
      <>
        <Link to="/guide/mcp" className="font-medium text-brand-600 hover:text-brand-700">
          MCP連携ガイド
        </Link>
        の「うまくつながらないとき」を確認してください。多くの場合、アクセストークンの入力ミスや失効が原因です。
      </>
    ),
  },
  {
    q: "投稿できるファイル形式は?",
    a: "スキルはZIP一式、またはSKILL.md単体ファイルに対応しています。プロンプトはテキストのみです。",
  },
];

export default function DocsPage() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center gap-3">
        <LogoMark className="h-11 w-11" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">ドキュメント</p>
          <h1 className="text-xl font-bold text-slate-900">使い方ガイド</h1>
        </div>
      </div>

      <p className="mb-10 text-sm leading-relaxed text-slate-600">
        AI Skills Hub は、Claude Code のスキル・プロンプトを共有するためのサイトです。
        <span className="whitespace-nowrap">このページでは、</span>
        サイト全体の機能と基本的な使い方をまとめています。
      </p>

      {/* できること */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-slate-900">できること</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <f.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{f.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 基本の使い方 */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-slate-900">基本の使い方</h2>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <StepNumber n={1} />
            <div className="flex-1">
              <p className="mb-1 text-sm font-semibold text-slate-900">会員登録・ログインする</p>
              <p className="text-sm leading-relaxed text-slate-600">
                メールアドレスとパスワードで登録し、届いた確認メールのリンクからログインできるようになります。
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <StepNumber n={2} />
            <div className="flex-1">
              <p className="mb-1 text-sm font-semibold text-slate-900">一覧から探す</p>
              <p className="text-sm leading-relaxed text-slate-600">
                キーワード検索・タグ絞り込み・並び替えを使って、目的のスキル・プロンプトを見つけます。
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <StepNumber n={3} />
            <div className="flex-1">
              <p className="mb-1 text-sm font-semibold text-slate-900">お気に入り登録・利用する</p>
              <p className="text-sm leading-relaxed text-slate-600">
                スキルはダウンロード、プロンプトはコピーまたはclaude.aiへの受け渡しで利用します。気に入ったものはお気に入り登録しておくと後から見返せます。
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <StepNumber n={4} />
            <div className="flex-1">
              <p className="mb-1 text-sm font-semibold text-slate-900">自分のスキル・プロンプトを投稿する</p>
              <p className="text-sm leading-relaxed text-slate-600">
                ヘッダーの「+ 投稿する」から投稿できます。詳しい書き方は
                <Link to="/guide/skills" className="mx-1 font-medium text-brand-600 hover:text-brand-700">
                  SKILLとは?
                </Link>
                /
                <Link to="/guide/prompts" className="mx-1 font-medium text-brand-600 hover:text-brand-700">
                  プロンプトとは?
                </Link>
                /
                <Link to="/guide/external" className="mx-1 font-medium text-brand-600 hover:text-brand-700">
                  OSS紹介とは?
                </Link>
                を参照してください。
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <StepNumber n={5} />
            <div className="flex-1">
              <p className="mb-1 text-sm font-semibold text-slate-900">Claudeに話しかけて使う(MCP連携)</p>
              <p className="text-sm leading-relaxed text-slate-600">
                Claude Code / Claude Desktopから直接検索・参照できます。詳しくは
                <Link to="/guide/mcp" className="mx-1 font-medium text-brand-600 hover:text-brand-700">
                  MCP連携ガイド
                </Link>
                を参照してください。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* アカウント */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-slate-900">アカウント</h2>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <p className="mb-1 text-sm font-semibold text-slate-900">プロフィール編集</p>
            <p className="text-sm leading-relaxed text-slate-600">
              表示名・姓名・会社名・役職・部署・従業員の種類を、
              <Link to="/settings/profile" className="mx-1 font-medium text-brand-600 hover:text-brand-700">
                プロフィール編集画面
              </Link>
              からいつでも変更できます。表示名は投稿者名など、サイト内の各所に表示されます。
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <p className="mb-1 text-sm font-semibold text-slate-900">MCP用アクセストークン</p>
            <p className="text-sm leading-relaxed text-slate-600">
              MCPクライアントから接続するためのトークンを、
              <Link to="/settings/tokens" className="mx-1 font-medium text-brand-600 hover:text-brand-700">
                アクセストークン管理画面
              </Link>
              で発行・失効できます。
            </p>
          </div>
        </div>
      </section>

      {/* よくある質問 */}
      <section id="faq" className="mb-10 scroll-mt-20">
        <h2 className="mb-4 text-lg font-bold text-slate-900">よくある質問</h2>
        <div className="flex flex-col gap-3">
          {FAQ.map((item) => (
            <div key={item.q} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <p className="mb-1.5 text-sm font-semibold text-slate-900">Q. {item.q}</p>
              <p className="text-sm leading-relaxed text-slate-600">A. {item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          一覧を見る
        </Link>
        <Link
          to="/guide/mcp"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          MCP連携ガイドを見る
        </Link>
      </div>
    </div>
  );
}
