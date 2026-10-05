import { Link } from "react-router-dom";
import {
  ArrowLeftIcon,
  BotIcon,
  BoxIcon,
  CheckIcon,
  CodeIcon,
  CopyIcon,
  ExternalLinkIcon,
  PlugIcon,
  SparkleIcon,
} from "../components/icons";

interface GuidePageProps {
  topic: "skill" | "prompt" | "agent" | "mod" | "external";
}

const AGENT_POINTS = [
  {
    title: "専門の役割を持つサブエージェントを定義できる",
    body: "「コードレビュー担当」「テスト作成担当」など、特定の役割に特化したサブエージェントを1枚のMarkdownで定義します。Claude Codeは作業内容に合うサブエージェントへ処理を任せ、メインの会話を汚さずに結果だけを受け取ります。",
  },
  {
    title: "定義ファイルの書き方",
    body: "冒頭のYAMLフロントマターに name(名前)と description(どんな時に任せるか)を書き、必要に応じて tools(使えるツール)や model を指定します。その下にMarkdownで、そのエージェントへの指示(システムプロンプト)を書きます。",
  },
  {
    title: "Claude Codeでの置き場所",
    body: "プロジェクト直下の .claude/agents/<名前>.md、または個人用に ~/.claude/agents/ 配下に置くと、Claude Codeが自動的に認識します。AI Skills Hubからダウンロードした .md ファイルをそのまま置くだけで使えます。",
  },
];

const MOD_POINTS = [
  {
    title: "Claude Codeの見た目と動作を拡張するプラグイン",
    body: "Modは、JavaScript/TypeScriptのイベントハンドラで構成されたClaude Codeプラグインです。コンテキストの使用量を示すペイン、プロンプト上のバンド、独自の/コマンド、ツール呼び出しの監視・ガードなど、スキルやMCPではできないことをClaude Codeの内側で実現します。",
  },
  {
    title: "投稿するのはプラグインのフォルダをZIPにしたもの",
    body: ".claude-plugin/plugin.json、hooks/hooks.json(modulesにフックモジュールを指定)、hooks/register.js(または .ts)を含むフォルダをそのままZIPにして投稿します。投稿時に構成を検査し、不備があれば理由を表示します。",
  },
  {
    title: "インストールは通常のプラグインと同じ",
    body: "AI Skills Hubのマーケットプレイスから claude plugin install <名前>@ai-skills-hub でインストールできます。1セッションだけ試す場合は claude --plugin-dir にZIPを指定します。Claude Code v2.1.287以降が必要です。",
  },
  {
    title: "ユーザー権限で動くコードです。信頼できるものだけを入れてください",
    body: "Modはサンドボックス化されず、ファイルの読み書き・プログラムの起動・ネットワーク通信を、あなたの権限で行えます。詳細ページには、投稿されたコードを静的に調べた「Modが行うこと」(使うイベントとAPI呼び出し)を表示します。組織の設定でModが無効になっている環境では読み込まれません。",
  },
];

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
    accentBgSoft: "bg-skill-dim",
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
    accentBgSoft: "bg-prompt-dim",
    Icon: SparkleIcon,
    title: "プロンプトとは？",
    intro:
      "プロンプトは、Claude(claude.ai / Claude Code)に投げる指示文をあらかじめ整えて再利用できるようにしたものです。AI Skills Hubでは、コピーしてそのまま貼り付けたり、claude.aiの新規チャットにワンクリックで差し込んだりして使えます。",
    points: PROMPT_POINTS,
    postLabel: "プロンプトを投稿する",
  },
  agent: {
    label: "Agent",
    accentBg: "bg-agent",
    accentText: "text-agent",
    accentBgSoft: "bg-agent-dim",
    Icon: BotIcon,
    title: "エージェントとは？",
    intro:
      "エージェント(サブエージェント)は、Claude Codeが特定の役割の作業を任せるために使う、専用の指示書です。AI Skills Hubでは、チームで育てたエージェント定義(.mdファイル)を共有し、誰でもダウンロードしてそのまま使えるようにします。",
    points: AGENT_POINTS,
    postLabel: "エージェントを投稿する",
  },
  mod: {
    label: "Mod",
    accentBg: "bg-mod",
    accentText: "text-mod",
    accentBgSoft: "bg-mod-dim",
    Icon: PlugIcon,
    title: "Modとは？",
    intro:
      "Modは、Claude Codeの画面や動作を拡張するプラグインです。AI Skills Hubでは、チームで作ったModをZIPで共有し、マーケットプレイスからそのままインストールできるようにします。実行されるのはあなたの権限のコードなので、インストール前に内容を確認できるようにしています。",
    points: MOD_POINTS,
    postLabel: "Modを投稿する",
  },
  external: {
    label: "OSS紹介",
    accentBg: "bg-external",
    accentText: "text-external",
    accentBgSoft: "bg-external-dim",
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
      <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" />
        一覧に戻る
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-onaccent ${accentBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className={`font-display text-xs font-semibold uppercase tracking-wide ${accentText}`}>{label}</p>
          <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
        </div>
      </div>

      <p className="mb-8 text-sm leading-relaxed text-ink-secondary">{intro}</p>

      <div className="mb-8 flex flex-col gap-4">
        {points.map((p) => (
          <div key={p.title} className="flex gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${accentBgSoft} ${accentText}`}
            >
              <CheckIcon className="h-3 w-3" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{p.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{p.body}</p>
            </div>
          </div>
        ))}
      </div>

      {topic === "skill" ? (
        <div className="mb-8 rounded-xl border border-border bg-surface-2 p-4">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            <CodeIcon className="h-3.5 w-3.5" />
            SKILL.md の例
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-ink">
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
        <div className="mb-8 rounded-xl border border-border bg-surface-2 p-4">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            <CopyIcon className="h-3.5 w-3.5" />
            使い方の流れ
          </p>
          <ol className="flex flex-col gap-2 text-sm text-ink-secondary">
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-prompt-dim text-xs font-semibold text-prompt">
                1
              </span>
              一覧からプロンプトを探す(タグ・検索・ランキングを活用)
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-prompt-dim text-xs font-semibold text-prompt">
                2
              </span>
              「クリップボードにコピー」または「claude.aiで新規チャットを開く」を押す
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-prompt-dim text-xs font-semibold text-prompt">
                3
              </span>
              必要に応じて自分の状況に合わせて文面を調整してから送信する
            </li>
          </ol>
        </div>
      ) : topic === "mod" ? (
        <div className="mb-8 rounded-xl border border-border bg-surface-2 p-4">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            <CodeIcon className="h-3.5 w-3.5" />
            Modの構成と最小のコード例
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-ink">
{`first-mod/
├── .claude-plugin/plugin.json   {"name": "first-mod", "version": "0.1.0", ...}
└── hooks/
    ├── hooks.json               {"modules": ["./register.js"]}
    └── register.js

// hooks/register.js: ツール呼び出しを数え、スピナーの横に表示する
let calls = 0
export function register(on) {
  on('tool.call', async ($, e, next) => {
    calls += 1
    $.ui.invalidate('ui.render')
    return next(e)
  })
  on('ui.render', { component: 'Spinner' }, async ($, e, next) =>
    next({ ...e, props: { ...e.props, suffix: ' · tool calls: ' + calls + '…' } }))
}`}
          </pre>
        </div>
      ) : topic === "agent" ? (
        <div className="mb-8 rounded-xl border border-border bg-surface-2 p-4">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            <CodeIcon className="h-3.5 w-3.5" />
            エージェント定義(.md)の例
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-ink">
{`---
name: code-reviewer
description: コードの変更をレビューしたいときに使う。正確性と保守性の観点で指摘する。
tools: Read, Grep, Glob
---

あなたはシニアエンジニアとして、変更差分をレビューします。

1. 変更の意図を1〜2文で要約する
2. 「正確性」「保守性」「命名」の観点で指摘する
3. 指摘は具体的なファイル名と行番号つきで書く`}
          </pre>
        </div>
      ) : (
        <div className="mb-8 rounded-xl border border-border bg-surface-2 p-4">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            登録の流れ
          </p>
          <ol className="flex flex-col gap-2 text-sm text-ink-secondary">
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-external-dim text-xs font-semibold text-external">
                1
              </span>
              投稿画面で種別「OSS紹介」を選び、紹介先のGitHub URLを入力する
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-external-dim text-xs font-semibold text-external">
                2
              </span>
              「自動取得」を押すと、タイトル・概要・作者・ライセンスが自動入力される(空欄の項目のみ)
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-external-dim text-xs font-semibold text-external">
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
          className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-onaccent ${accentBg} hover:opacity-90`}
        >
          {postLabel}
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-2"
        >
          一覧を見る
        </Link>
        <a
          href="https://docs.claude.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-ink-secondary hover:text-ink"
        >
          Claude公式ドキュメント
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
