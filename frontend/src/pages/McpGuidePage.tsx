import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  InfoIcon,
  PlugIcon,
  SearchIcon,
  TerminalIcon,
} from "../components/icons";

// このAI Skills HubのMCPエンドポイントのURL。専用ポータルドメインは使わず、
// このサイト自身のオリジン(カスタムドメイン/workers.devいずれでも自動追従)を使う。
const MCP_URL = `${window.location.origin}/api/mcp`;
const MCP_SERVER_NAME = "ai-skills-hub-selfauth";

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
    // ターミナル風の見た目はページのテーマに関わらず常にダーク固定にしている(実際の端末を模しているため)
    <div className="flex items-center gap-2 rounded-lg bg-[#14171c] px-3.5 py-2.5">
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

const USAGE_EXAMPLES = [
  {
    prompt: "AI Skills Hubで議事録に関するスキルを探して",
    note: "search_items が呼ばれ、該当するスキル・プロンプトの一覧(タイトル・概要・タグ・投稿者)が返ってきます。",
  },
  {
    prompt: "一番上のやつ、詳しく教えて",
    note: "get_item が呼ばれ、そのアイテムの詳細説明・使い方メモ・タグなどが返ってきます。",
  },
  {
    prompt: "AI Skills Hubにはどんなタグがある?",
    note: "list_tags が呼ばれ、絞り込みに使えるタグの一覧が返ってきます。",
  },
  {
    prompt: "〇〇スキルをインストールして",
    note: "後述の「スキルをインストールしてもらう」参照。検索→中身の取得→手元への保存まで自動で行われます。",
  },
  {
    prompt: "さっき話した内容をプロンプトとしてAI Skills Hubに投稿して",
    note: "create_item が呼ばれ、新規投稿(スキル/プロンプト/OSS紹介)が作成されます。",
  },
  {
    prompt: "さっきのスキル、お気に入りに登録しておいて",
    note: "set_item_favorite が呼ばれ、お気に入りに登録されます(一覧画面のお気に入り数にも反映されます)。",
  },
];

type ClientKind = "code" | "desktop";

const CLIENT_TABS: { key: ClientKind; label: string }[] = [
  { key: "code", label: "Claude Code" },
  { key: "desktop", label: "Claude Desktop" },
];

export default function McpGuidePage() {
  const [client, setClient] = useState<ClientKind>("code");
  const isCode = client === "code";

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" />
        一覧に戻る
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cta text-cta-text">
          <PlugIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-ink-secondary">MCP連携</p>
          <h1 className="font-display text-xl font-bold text-ink">Claudeに話しかけて使う</h1>
        </div>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-ink-secondary">
        AI Skills Hubは、MCP(Model Context Protocol)という仕組みを使って、Claude Code / Claude Desktopから直接呼び出せるようになっています。一度つないでおけば、ブラウザでこのサイトを開かなくても、Claudeに話しかけるだけでスキル・プロンプトを検索したり、中身を確認したり、スキルをそのまま手元にインストールしたりできます。
      </p>

      {/* クライアント選択タブ */}
      <div className="mb-8 flex gap-2 rounded-lg border border-border bg-surface p-1 shadow-card">
        {CLIENT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setClient(tab.key)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold font-display transition-colors ${
              client === tab.key ? "bg-active text-active-text" : "text-ink-secondary hover:bg-surface-2"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 事前準備 */}
      <section className="mb-8 rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          <InfoIcon className="h-3.5 w-3.5" />
          事前に必要なもの
        </p>
        {isCode ? (
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
                  MCP用アクセストークン
                </Link>{" "}
                を発行済みであること(下記手順の中で発行できます)
              </span>
            </li>
          </ul>
        ) : (
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-ink-secondary">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
              <span>
                パソコンに <strong className="font-semibold">Claude Desktop</strong> アプリがインストール済みであること
                (未導入の場合は情報システム部門・導入担当にお問い合わせください)
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
              「カスタムコネクタ」機能が使えるプラン(Pro/Max/Team/Enterprise等)でログインしていること。
              使えない場合は管理者にご確認ください
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
              AI Skills Hub のアカウントを持っていること
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
              <span>
                <Link to="/settings/tokens" className="font-medium text-ink hover:underline">
                  MCP用アクセストークン
                </Link>{" "}
                を発行済みであること(下記手順の中で発行できます)
              </span>
            </li>
          </ul>
        )}
      </section>

      {/* 接続手順 */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-ink">接続する(最初の1回だけ)</h2>

        {isCode ? (
          <div className="flex flex-col gap-5">
            <div className="flex gap-3">
              <StepNumber n={1} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">MCP用アクセストークンを発行する</p>
                <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
                  AI Skills Hubにログインし、
                  <Link to="/settings/tokens" className="font-medium text-ink hover:underline">
                    「MCP用アクセストークン」ページ
                  </Link>
                  で新しいトークンを発行してコピーしておきます。この値は発行直後しか表示されないので
                  必ずコピーしてください。
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <StepNumber n={2} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">「ターミナル」を開く</p>
                <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
                  ターミナルとは、コマンド(文字の命令)を打ち込んで操作する黒っぽい画面のことです。
                  普段Claude Codeを起動しているときに使っている画面がそれです。Claude Codeを起動していない場合は、
                  まずいつも通りClaude Codeを起動してください。
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <StepNumber n={3} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">
                  下のコマンドの<code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">&lt;トークン&gt;</code>
                  部分を手順1でコピーした値に置き換え、ターミナルに貼り付けてEnterキーを押す
                </p>
                <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
                  右の「コピー」ボタンでコマンド全体をコピーしたあと、
                  <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">&lt;トークン&gt;</code>
                  の部分だけを発行したトークンに書き換えてから実行してください。
                </p>
                <CopyableCommand
                  command={`claude mcp add --transport http ${MCP_SERVER_NAME} ${MCP_URL} --header "Authorization: Bearer <トークン>"`}
                />
                <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                  ※ <code className="font-mono">--header</code> は複数の値を取れるオプションのため、
                  必ず名前・URLの<strong className="font-semibold">後ろ</strong>に置いてください。前に置くと
                  <code className="font-mono">error: missing required argument &apos;name&apos;</code>
                  のようなエラーになります。うまくいかない場合はターミナルで{" "}
                  <code className="font-mono">claude mcp add --help</code> を実行して確認してください。
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <StepNumber n={4} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">つながったか確認する</p>
                <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
                  Claude Codeの入力欄で下のコマンドを実行し、
                  <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">{MCP_SERVER_NAME}</code> が
                  「Connected」と表示されれば接続完了です。以降、毎回この作業をする必要はありません。
                </p>
                <CopyableCommand command="/mcp" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex gap-3">
              <StepNumber n={1} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">MCP用アクセストークンを発行する</p>
                <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
                  AI Skills Hubにログインし、
                  <Link to="/settings/tokens" className="font-medium text-ink hover:underline">
                    「MCP用アクセストークン」ページ
                  </Link>
                  で新しいトークンを発行してコピーしておきます。この値は発行直後しか表示されないので
                  必ずコピーしてください。
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <StepNumber n={2} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">Claude Desktopの設定画面を開く</p>
                <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
                  Claude Desktopを起動し、キーボードで <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">Ctrl + ,</code>{" "}
                  (Macは <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">Cmd + ,</code>)を押します。
                  うまくいかない場合は、左上のメニューアイコン →「File」(ファイル)→「Settings」(設定)を選んでください。
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <StepNumber n={3} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">
                  左側のメニューから「Connectors」(コネクタ)を選ぶ
                </p>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  設定画面が開いたら、左側の一覧から「Connectors」をクリックします。
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <StepNumber n={4} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">
                  画面を一番下までスクロールし、「Add custom connector」(カスタムコネクタを追加)をクリックする
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <StepNumber n={5} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">名前とURLを入力する</p>
                <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
                  「Name」(名前)欄には好きな名前(例: <span className="font-mono">AI Skills Hub</span>)を、
                  「URL」欄には下記をそのままコピーして貼り付けてください。
                </p>
                <CopyableCommand command={MCP_URL} />
              </div>
            </div>

            <div className="flex gap-3">
              <StepNumber n={6} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">
                  認証で「サインインなし」を選び、リクエストヘッダーでトークンを設定する
                </p>
                <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
                  「認証」の項目で <strong className="font-semibold">サインインなし</strong> を選択します。
                  その下の「リクエストヘッダー」で、キーに
                  <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">authorization</code>
                  を選び、値の欄に下のコマンドの
                  <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">&lt;トークン&gt;</code>
                  部分を手順1でコピーした値に置き換えたものを入力してから「追加」を押してください。
                </p>
                <CopyableCommand command="Bearer <トークン>" />
                <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                  ※ 値には <span className="font-mono">Bearer</span> を含めて入力してください(認証方式の指定を兼ねています)。
                  リクエストヘッダーの入力欄が見当たらないバージョンの場合は、代わりにURLの末尾へ
                  <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">?token=&lt;トークン&gt;</code>
                  を付け足す方法でも接続できます。
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <StepNumber n={7} />
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-ink">つながったか確認する</p>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  Claude Desktopの設定画面に戻り、「AI Skills Hub」の状態が「Connected」(接続済み)に
                  なっていれば完了です。チャット画面の入力欄の下にあるツールアイコンから、
                  接続したツールが使えるようになっているかも確認できます。
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* うまくいかないとき */}
      <section className="mb-8 rounded-xl border border-warn-border bg-warn-bg p-4">
        <p className="mb-1.5 text-sm font-semibold text-external">うまくつながらないとき</p>
        <p className="text-sm leading-relaxed text-ink-secondary">
          「Unauthorized」「401」、またはClaude Desktopの「サーバーに接続できませんでした」のような
          メッセージが出る場合、多くはトークン関連の入力ミスが原因です。以下を確認してください。
        </p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed text-ink-secondary">
          <li>
            Claude Codeの場合: <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs text-ink">Bearer </code>
            の後ろに半角スペースが入っているか、トークンのコピー漏れがないか
          </li>
          <li>
            Claude Desktopの場合: URLの末尾が
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs text-ink">?token=</code>
            から始まっているか、トークンの前後に余計な空白・改行が入っていないか
          </li>
          <li>
            <Link to="/settings/tokens" className="font-medium text-external underline">
              トークン管理ページ
            </Link>
            でそのトークンが失効済みになっていないか
          </li>
        </ul>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          解決しない場合は新しいトークンを発行し直して設定を作り直すのが確実です。それでも解決しない場合は、
          エラーメッセージのスクリーンショットを添えて管理者にご連絡ください。
        </p>
      </section>

      {/* 使い方 */}
      <section className="mb-8">
        <h2 className="mb-4 font-display text-lg font-bold text-ink">使い方</h2>
        <p className="mb-4 text-sm leading-relaxed text-ink-secondary">
          むずかしいコマンドを覚える必要はありません。Claudeに、いつも通り日本語で話しかけるだけです。「AI Skills Hub」という単語を含めて頼むと、確実にこのサイトの情報を使って答えてくれます。
        </p>

        <div className="flex flex-col gap-3">
          {USAGE_EXAMPLES.map((ex) => (
            <div key={ex.prompt} className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="mb-1.5 flex items-center gap-2 font-mono text-sm text-ink">
                <SearchIcon className="h-3.5 w-3.5 shrink-0 text-ink-secondary" />
                「{ex.prompt}」
              </p>
              <p className="text-xs leading-relaxed text-ink-secondary">{ex.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* スキルのインストール */}
      <section className="mb-8 rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          <TerminalIcon className="h-3.5 w-3.5" />
          スキルをインストールしてもらう
        </p>
        <p className="mb-3 text-sm leading-relaxed text-ink-secondary">
          Claude Codeに「<strong className="font-semibold">〇〇スキルをインストールして</strong>」と頼むと、
          Claude Codeが自動的に AI Skills Hub からそのスキルを探し出し、中身を取得して、手元のパソコンの
          スキル置き場(<code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">.claude/skills/</code>{" "}
          など)にファイルを作成・登録するところまで行ってくれます。ダウンロード操作やファイルのコピーを
          自分で行う必要はありません。
        </p>
        <p className="mb-3 text-xs leading-relaxed text-ink-secondary">
          ※この「ファイルへの自動保存」は、パソコン上のファイルを直接操作できるClaude Code
          ならではの動作です。Claude Desktopでも検索・閲覧(内容の確認)は同様にできますが、
          ファイルへの保存は行われないため、必要な場合は表示された内容を手元にコピーしてください。
        </p>
        <div className="mb-3 rounded-lg bg-surface-2 p-3">
          <p className="mb-1 text-xs font-semibold text-ink-secondary">話しかけ方の例</p>
          <p className="font-mono text-sm text-ink">「PRレビューチェックリストスキルをインストールして」</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-1 text-xs font-semibold text-ink-secondary">現在の制限</p>
          <p className="text-xs leading-relaxed text-ink-secondary">
            この自動インストールが確実に使えるのは、<strong className="font-medium text-ink-secondary">SKILL.md単体形式</strong>で
            投稿されたスキルのみです。ZIP形式で投稿されたスキル(複数ファイルをまとめたもの)は、MCP経由では
            中身を取得できないため、お手数ですがWebサイトの詳細画面からダウンロードしてください。投稿画面で
            アイテムの種類(SKILL.md単体 / ZIP)を確認できます。
          </p>
        </div>
      </section>

      {/* できないこと */}
      <section className="mb-8 rounded-xl border border-border bg-surface-2 p-4">
        <p className="mb-2 text-sm font-semibold text-ink-secondary">MCP経由ではできないこと</p>
        <p className="text-sm leading-relaxed text-ink-secondary">
          検索・閲覧に加え、新規投稿・編集・お気に入り登録もMCP経由で行えます。ただし、ZIP形式のスキル資産の
          アップロード・差し替えはMCPのテキストベースの入力では扱えないため、Webサイト上で行ってください
          (SKILL.md単体形式のスキルであれば、MCP経由での投稿・編集も可能です)。また、MCP経由でスキル・
          プロンプトを見ても、一覧画面の利用数(users)には反映されません(ダウンロード・コピー・紹介元を見る、
          という「実際に中身を利用した」操作をWebサイト上で行った際にのみ計測されます)。
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
