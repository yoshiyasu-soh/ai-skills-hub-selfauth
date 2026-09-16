import { Link } from "react-router-dom";
import { ArrowLeftIcon, BoxIcon, CheckIcon, CodeIcon, CopyIcon, ExternalLinkIcon, SparkleIcon } from "../components/icons";

interface GuidePageProps {
  topic: "skill" | "prompt" | "external";
}

const SKILL_POINTS = [
  {
    title: "SKILL.md が本体",
    body: "冒頭のYAMLフロントマターに name(スキル名)と description(どんな時に使うか)を書き、その下にMarkdownで具体的な指示・手順を書きます。Claudeはこの description を見て、今の作業に関係があるかを自分で判断します。",
  },
  {
    title: "コーディング規約や定型作業をパッケージ化できる",
    body: "「このリポジトリではテストはこう書く」「この形式でレビューコメントを書く」といった、繰り返し使う手順・知識をSKILL.mdとしてまとめておくと、Claudeがその場面で自動的に読み込んで従います。参考ファイルやスクリプトを同梱することもできます。",
  },
  {
    title: "Claude Codeでの置き場所",
    body: "プロジェクト直下の .claude/skills/<スキル名>/SKILL.md、または個人用に ~/.claude/skills/ 配下に置くと、Claude Codeが自動的に認識します。関連する場面で自動的に使われるほか、/スキル名 のように明示的に呼び出すこともできます。",
  },
];

const PROMPT_POINTS = [
  {
    title: "「毎回書いている指示文」をテンプレート化する",
    body: "「このコードをレビューして、観点はA/B/C」「議事録をこの形式で要約して」など、繰り返し使う指示文をあらかじめ整えて登録しておけば、次からはコピー&ペーストだけで同じ質を再現できます。",
  },
  {
    title: "使い方は2通り",
    body: "①「クリップボードにコピー」して、claude.ai やClaude Codeの入力欄に貼り付ける。②「claude.aiで新規チャットを開く」を使うと、プロンプトが入力済みの状態で新しいチャットがそのまま開きます。",
  },
  {
    title: "良いプロンプトの条件",
    body: "何を出力してほしいか(形式・粒度)が明確で、必要な前提情報が過不足なく含まれていること。汎用的すぎず、かつ他の人にも使い回せる程度に具体的であることがちょうど良いバランスです。",
  },
];

const EXTERNAL_POINTS = [
  {
    title: "自作ではなく「紹介」のための投稿種別",
    body: "GitHub等で既に公開されているOSSのスキル・プロンプト・ツールを、AI Skills Hub上に「こんな便利なものがある」と紹介するための投稿です。ファイルそのものはホストせず、紹介先へのリンクのみを保持します。著作権・ライセンスは紹介元の作者に帰属します。",
  },
  {
    title: "GitHubのURLを入力するだけで自動入力できる",
    body: "投稿画面で紹介先のGitHub URLを入力して「自動取得」を押すと、GitHub APIからタイトル・概要・作者・ライセンスを取得し、空欄の項目に自動入力します(現在はGitHubのみ対応)。",
  },
  {
    title: "「紹介元を見る」で参照数がカウントされる",
    body: "一覧・詳細ページには通常のダウンロード/コピーの代わりに「紹介元を見る」ボタンが表示されます。これを押すと紹介先のURLが新しいタブで開き、利用数(users)としてカウントされます。",
  },
];

const TOPIC_META = {
  skill: {
    label: "Skill",
    accentBg: "bg-skill",
    accentText: "text-skill",
    accentBgSoft: "bg-skill/10",
    Icon: BoxIcon,
    title: "SKILLとは？",
    intro:
      "SKILLは、Claude(claude.ai / Claude Code / Claude Agent SDK)に特定の作業のやり方を教えるための、指示書と関連ファイルのまとまりです。AI Skills Hubでは、社内で育てたSKILLをZIP一式やSKILL.md単体でここに共有し、誰でもダウンロードしてそのまま使えるようにします。",
    points: SKILL_POINTS,
    postLabel: "SKILLを投稿する",
  },
  prompt: {
    label: "Prompt",
    accentBg: "bg-prompt",
    accentText: "text-prompt",
    accentBgSoft: "bg-prompt/10",
    Icon: SparkleIcon,
    title: "プロンプトとは？",
    intro:
      "プロンプトは、Claude(claude.ai / Claude Code)に投げる指示文をあらかじめ整えて再利用できるようにしたものです。AI Skills Hubでは、コピーしてそのまま貼り付けたり、claude.aiの新規チャットにワンクリックで差し込んだりして使えます。",
    points: PROMPT_POINTS,
    postLabel: "プロンプトを投稿する",
  },
  external: {
    label: "OSS紹介",
    accentBg: "bg-amber-500",
    accentText: "text-amber-600",
    accentBgSoft: "bg-amber-500/10",
    Icon: ExternalLinkIcon,
    title: "OSS紹介とは？",
    intro:
      "OSS紹介は、自作物ではなく、既にGitHub等で公開されている便利なスキル・プロンプト・ツールを「こんなものがあります」と紹介するための投稿種別です。ファイルそのものはAI Skills Hub上にホストせず、紹介先へのリンクのみを保持します。著作権・ライセンスは紹介元の作者に帰属します。",
    points: EXTERNAL_POINTS,
    postLabel: "OSS紹介を投稿する",
  },
} as const;

export default function GuidePage({ topic }: GuidePageProps) {
  const meta = TOPIC_META[topic];
  const { label, accentBg, accentText, accentBgSoft, Icon, title, intro, points, postLabel } = meta;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeftIcon className="h-4 w-4" />
        一覧に戻る
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${accentBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${accentText}`}>{label}</p>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        </div>
      </div>

      <p className="mb-8 text-sm leading-relaxed text-slate-600">{intro}</p>

      <div className="mb-8 flex flex-col gap-4">
        {points.map((p) => (
          <div key={p.title} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${accentBgSoft} ${accentText}`}
            >
              <CheckIcon className="h-3 w-3" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{p.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{p.body}</p>
            </div>
          </div>
        ))}
      </div>

      {topic === "skill" ? (
        <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <CodeIcon className="h-3.5 w-3.5" />
            SKILL.md の例
          </p>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">
{`---
name: pr-review-checklist
description: プルリクエストのレビュー依頼を受けたときに使う。観点ごとにコメントを分類する。
---

# PRレビューのやり方

1. 変更差分から意図を要約する
2. 「正確性」「保守性」「命名」の3観点でコメントする
3. 指摘は具体的な行番号付きで書く`}
          </pre>
        </div>
      ) : topic === "prompt" ? (
        <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <CopyIcon className="h-3.5 w-3.5" />
            使い方の流れ
          </p>
          <ol className="flex flex-col gap-2 text-sm text-slate-700">
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-prompt/10 text-xs font-semibold text-prompt">
                1
              </span>
              一覧からプロンプトを探す(タグ・検索・ランキングを活用)
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-prompt/10 text-xs font-semibold text-prompt">
                2
              </span>
              「クリップボードにコピー」または「claude.aiで新規チャットを開く」を押す
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-prompt/10 text-xs font-semibold text-prompt">
                3
              </span>
              必要に応じて自分の状況に合わせて文面を調整してから送信する
            </li>
          </ol>
        </div>
      ) : (
        <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            登録の流れ
          </p>
          <ol className="flex flex-col gap-2 text-sm text-slate-700">
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-xs font-semibold text-amber-600">
                1
              </span>
              投稿画面で種別「OSS紹介」を選び、紹介先のGitHub URLを入力する
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-xs font-semibold text-amber-600">
                2
              </span>
              「自動取得」を押すと、タイトル・概要・作者・ライセンスが自動入力される(空欄の項目のみ)
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-xs font-semibold text-amber-600">
                3
              </span>
              内容を確認・補足して投稿すると、一覧・詳細ページから「紹介元を見る」で参照できるようになる
            </li>
          </ol>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/post"
          className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white ${accentBg} hover:opacity-90`}
        >
          {postLabel}
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          一覧を見る
        </Link>
        <a
          href="https://docs.claude.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600"
        >
          Claude公式ドキュメント
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
