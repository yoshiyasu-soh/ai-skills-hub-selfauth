import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, BoxIcon, CheckIcon, CopyIcon, ExternalLinkIcon, InfoIcon } from "../components/icons";

// このAI Skills Hubのマーケットプレイス定義のURL。専用ポータルドメインは使わず、
// このサイト自身のオリジン(カスタムドメイン/workers.devいずれでも自動追従)を使う。
const MARKETPLACE_URL = `${window.location.origin}/api/plugins/marketplace.json`;

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードAPIが使えない環境では何もしない(手動選択でコピーしてもらう)
    }
  }

  return (
    <div className="flex items-start gap-2 rounded-lg bg-[#14171c] px-3.5 py-2.5">
      <code className="flex-1 overflow-x-auto whitespace-pre font-mono text-[13px] leading-relaxed text-white/90">
        {command}
      </code>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="flex shrink-0 items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-xs font-medium text-white/70 transition-colors hover:bg-white/10"
      >
        {copied ? (
          <>
            <CheckIcon className="h-3 w-3 text-success" />
            コピーしました
          </>
        ) : (
          <>
            <CopyIcon className="h-3 w-3" />
            コピー
          </>
        )}
      </button>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cta text-sm font-bold text-cta-text">
      {n}
    </span>
  );
}

type OsKind = "mac" | "windows";

const OS_TABS: { key: OsKind; label: string }[] = [
  { key: "mac", label: "Mac / Linux" },
  { key: "windows", label: "Windows" },
];

const SETTINGS_JSON_PATH: Record<OsKind, string> = {
  mac: "~/.claude/settings.json",
  windows: "%USERPROFILE%\\.claude\\settings.json",
};

function marketplaceSnippet(headersHelper: string): string {
  return `{
  "extraKnownMarketplaces": {
    "ai-skills-hub": {
      "source": {
        "source": "url",
        "url": "${MARKETPLACE_URL}",
        "headersHelper": "${headersHelper}"
      }
    }
  }
}`;
}

export default function ClaudePluginGuidePage() {
  const [os, setOs] = useState<OsKind>("mac");
  const isMac = os === "mac";

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" />
        一覧に戻る
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cta text-cta-text">
          <BoxIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            Claude Codeプラグイン連携
          </p>
          <h1 className="font-display text-xl font-bold text-ink">投稿されたスキルをそのままインストールする</h1>
        </div>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-ink-secondary">
        AI Skills Hubに投稿されたスキル(type=skill)は、投稿と同時に自動的にClaude Codeの
        プラグインマーケットプレイスとしても配信されます。ここで説明する設定を一度行っておけば、
        以後は誰かが新しいスキルを投稿するたびに、あなたのClaude Codeからも
        <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">/plugin</code>
        コマンドでそのまま見つけてインストールできるようになります。
        <strong className="font-semibold text-ink">サイト側で別途「マーケットプレイスに登録する」といった操作は不要です。</strong>
        いつも通りスキルを投稿するだけで自動的に反映されます。
      </p>

      {/* 事前に必要なもの */}
      <section className="mb-8 rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          <InfoIcon className="h-3.5 w-3.5" />
          事前に必要なもの
        </p>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-ink-secondary">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
            <span>
              パソコンに <strong className="font-semibold">Claude Code</strong> がインストール済みであること
              (未導入の場合は情報システム部門・導入担当にお問い合わせください)
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
            AI Skills Hub のアカウントを持っていること
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
            <span>
              <Link to="/settings/tokens" className="font-medium text-ink hover:underline">
                個人アクセストークン
              </Link>{" "}
              を発行済みであること(MCP連携で使っているものと共用できます)
            </span>
          </li>
        </ul>
      </section>

      {/* OS選択タブ */}
      <div className="mb-8 flex gap-2 rounded-lg border border-border bg-surface p-1 shadow-card">
        {OS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setOs(tab.key)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold font-display transition-colors ${
              os === tab.key ? "bg-active text-active-text" : "text-ink-secondary hover:bg-surface-2"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 設定手順 */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-ink">設定する(最初の1回だけ)</h2>
        <div className="flex flex-col gap-5">
          <div className="flex gap-3">
            <StepNumber n={1} />
            <div className="flex-1">
              <p className="mb-1.5 text-sm font-semibold text-ink">個人アクセストークンを発行する</p>
              <p className="text-sm leading-relaxed text-ink-secondary">
                まだ発行していない場合は、
                <Link to="/settings/tokens" className="font-medium text-ink hover:underline">
                  「アクセストークン管理」ページ
                </Link>
                で新しいトークンを発行してコピーしておきます。この値は発行直後しか表示されないので
                必ずコピーしてください。
              </p>
            </div>
          </div>

          {isMac ? (
            <div className="flex gap-3">
              <StepNumber n={2} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">
                  トークンをファイルに保存し、認証用スクリプトを作成する
                </p>
                <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
                  ターミナルで以下を実行します(<code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">&lt;トークン&gt;</code>{" "}
                  は手順1でコピーした値に置き換えてください)。
                </p>
                <CopyableCommand
                  command={`mkdir -p ~/.claude\necho '<トークン>' > ~/.claude/ai-skills-hub-token\nchmod 600 ~/.claude/ai-skills-hub-token\ncat > ~/.claude/ai-skills-hub-auth-helper.sh << 'EOF'\n#!/bin/bash\necho "{\\"Authorization\\": \\"Bearer $(cat ~/.claude/ai-skills-hub-token)\\"}"\nEOF\nchmod +x ~/.claude/ai-skills-hub-auth-helper.sh`}
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <StepNumber n={2} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">
                  トークンをファイルに保存し、認証用スクリプトを作成する
                </p>
                <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
                  Windowsでは<code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">headersHelper</code>
                  がcmd.exe経由で実行されるため、bashスクリプトの代わりにNode.jsスクリプトを使います。
                  メモ帳等で <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">%USERPROFILE%\.claude\ai-skills-hub-token.txt</code>{" "}
                  を作成し、中身にトークンの値だけを貼り付けて保存してください。続けて、同じフォルダに
                  <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">ai-skills-hub-auth-helper.js</code>
                  という名前で以下の内容のファイルを作成します。
                </p>
                <CopyableCommand
                  command={`const fs = require("fs");\nconst os = require("os");\nconst path = require("path");\nconst tokenPath = path.join(os.homedir(), ".claude", "ai-skills-hub-token.txt");\nconst token = fs.readFileSync(tokenPath, "utf8").trim();\nprocess.stdout.write(JSON.stringify({ Authorization: \`Bearer \${token}\` }));`}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <StepNumber n={3} />
            <div className="flex-1">
              <p className="mb-1.5 text-sm font-semibold text-ink">
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">{SETTINGS_JSON_PATH[os]}</code>{" "}
                にマーケットプレイスを追記する
              </p>
              <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
                すでに <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">extraKnownMarketplaces</code>{" "}
                がある場合は、そのオブジェクトの中に <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">"ai-skills-hub"</code>{" "}
                のキーを追記してください(既存の設定を上書きしないよう注意してください)。
              </p>
              <CopyableCommand
                command={marketplaceSnippet(
                  isMac ? "~/.claude/ai-skills-hub-auth-helper.sh" : 'node "%USERPROFILE%\\\\.claude\\\\ai-skills-hub-auth-helper.js"',
                )}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <StepNumber n={4} />
            <div className="flex-1">
              <p className="mb-1.5 text-sm font-semibold text-ink">Claude Codeを再起動し、反映されたか確認する</p>
              <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
                設定ファイルの変更を読み込むため、一度Claude Codeを再起動してください。その後、以下のコマンドを
                実行し、一覧に <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">ai-skills-hub</code>{" "}
                が表示されれば設定完了です。
              </p>
              <CopyableCommand command="/plugin marketplace list" />
            </div>
          </div>

          <div className="flex gap-3">
            <StepNumber n={5} />
            <div className="flex-1">
              <p className="mb-1.5 text-sm font-semibold text-ink">スキルをインストールする</p>
              <p className="text-sm leading-relaxed text-ink-secondary">
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">/plugin</code>{" "}
                コマンドでブラウズし、インストールしたいスキルを選ぶだけです。一覧に表示される名前・説明は、
                そのスキルの投稿画面で入力したタイトル・概要がそのまま使われます。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 仕組み */}
      <section className="mb-8 rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          <BoxIcon className="h-3.5 w-3.5" />
          仕組みと現在の制限
        </p>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-ink-secondary">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
            プラグイン化されるのは <strong className="font-medium text-ink-secondary">type=skill</strong> の投稿のみです。
            プロンプト・OSS紹介はマーケットプレイスの一覧には出てきません。
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
            SKILL.md単体形式の投稿は、そのままプラグインとして配信されます。
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
            ZIP形式の投稿は、中に <strong className="font-medium text-ink-secondary">SKILL.md</strong> というファイルが
            含まれている場合のみ変換できます。見つからない場合、エラーにはなりませんが、
            マーケットプレイスの一覧には表示されません。
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
            スキルを更新(ファイル差し替え)すると、インストール済みの利用者にも自動的に新しい内容が反映されます。
          </li>
        </ul>
      </section>

      {/* うまくいかないとき */}
      <section className="mb-8 rounded-xl border border-warn-border bg-warn-bg p-4">
        <p className="mb-1.5 text-sm font-semibold text-external">うまくいかないとき</p>
        <ul className="mt-1 flex flex-col gap-1.5 text-sm leading-relaxed text-ink-secondary">
          <li>
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs text-ink">/plugin marketplace list</code>{" "}
            に <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs text-ink">ai-skills-hub</code>{" "}
            が出てこない場合: settings.jsonの記述に構文ミス(カンマ抜け等)がないか、Claude Codeを再起動したかを確認してください。
          </li>
          <li>
            一覧は出るがスキルが1件も表示されない、または特定のスキルだけ出てこない場合:
            トークンの失効・入力ミス、またはそのスキルがZIP形式でSKILL.mdを含んでいない可能性があります。
          </li>
          <li>
            <Link to="/settings/tokens" className="font-medium text-external underline">
              トークン管理ページ
            </Link>
            でそのトークンが失効済みになっていないか確認してください。
          </li>
        </ul>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          解決しない場合は新しいトークンを発行し直して設定を作り直すのが確実です。それでも解決しない場合は、
          エラーメッセージのスクリーンショットを添えて管理者にご連絡ください。
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-cta px-4 py-2 text-sm font-semibold text-cta-text hover:bg-cta-hover"
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
