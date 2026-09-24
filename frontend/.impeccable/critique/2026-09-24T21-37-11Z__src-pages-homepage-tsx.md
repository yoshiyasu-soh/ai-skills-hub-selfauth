---
target: AI Skills Hub フロントエンド(ホーム・詳細・投稿・ランキング・ガイド 主要画面)
total_score: 20
max_score: 36
na_heuristics: 7
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\ysou\\OneDrive\\ドキュメント\\_works\\Claude\\cloudflare\\ai-skills-hub-selfauth\\frontend\\src\\pages\\HomePage.tsx"
target_fingerprint: "sha256:ca5475bb27029fc04ce8f1cdda109614caffe54047d945d8bbf9c864ae6f1782"
target_path: "C:\\Users\\ysou\\OneDrive\\ドキュメント\\_works\\Claude\\cloudflare\\ai-skills-hub-selfauth\\frontend\\src\\pages\\HomePage.tsx"
timestamp: 2026-09-24T21-37-11Z
slug: src-pages-homepage-tsx
---
Method: dual-agent (A: critique-assessment-a, B: critique-assessment-b)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | DL完了確認が裏での再取得のみで不可視 |
| 2 | Match System/Real World | 3 | DL失敗時に生の英語JSONが露出 |
| 3 | User Control and Freedom | 2 | DL失敗でアプリ外JSONへ追放、戻る以外の脱出手段なし |
| 4 | Consistency and Standards | 3 | 削除確認がOSネイティブconfirmで不統一 |
| 5 | Error Prevention | 1 | ファイル無しスキルでもDLボタン常時活性化(P0) |
| 6 | Recognition Rather Than Recall | 3 | アイコンにテキストラベル併記 |
| 7 | Flexibility and Efficiency | n/a | 主要動線への適用余地が限定的 |
| 8 | Aesthetic and Minimalist Design | 2 | 短い投稿の詳細ページ下に450px超の空白 |
| 9 | Error Recovery | 0 | DL失敗がUI/ナビを丸ごと失わせ回復手段皆無 |
| 10 | Help and Documentation | 3 | MCP連携ガイドは専門用語過多 |
| Total | | 20/36 | Acceptable(55.6%) |

## Design Specificity Verdict
汎用テンプレートで代替可能に近い。GitHub/npm系ディレクトリ意匠を踏襲し、PRODUCT.mdの差別化ポイント(ノウハウの発見性)を体現する固有の仕掛けがない。PRODUCT.mdが「差別化ポイントではない」と明記するMCP連携がヘッダー主要ナビ+フッターに重複露出という矛盾。
CLI detect: 0件。ブラウザ実地検出: ホーム24/詳細9/投稿7/ランキング25/ガイド4件。neon系はskill/prompt種別アクセントトークンの意図的デザインでfalse positiveと判断。low-contrast(--text-muted、ダーク3.0:1/ライト3.4:1、基準4.5:1)は系統的な実問題。nested-cardsはセグメントボタン誤検知の可能性、P3級。

## Priority Issues
[P0] スキルにファイル無しでもダウンロードボタン常時活性化、押すと生JSONエラーへ追放(ItemDetailPage.tsx)。Suggested: /impeccable harden
[P1] モバイル幅でヘッダーナビ崩壊+HomePage.tsx:180のwhitespace-nowrapで横スクロール。Suggested: /impeccable layout
[P1] MCP連携がPRODUCT.mdの位置づけと矛盾してナビ露出。Suggested: /impeccable clarify
[P1] --text-mutedと状態色(red-500/emerald-600)がWCAG AAコントラスト未達。Suggested: /impeccable colorize
[P2] タグフィルタ常時全展開で認知負荷高い。Suggested: /impeccable distill
[P2] 短い投稿詳細ページの空白過多。Suggested: /impeccable layout

## Persona Red Flags
Alex: コピーのショートカットなし、投稿フォームはドラッグ&ドロップ非対応。
Jordan: MCP連携ガイドが専門用語過多、DL失敗の英語JSONで行き止まり。
Riley: 添付ファイル無しスキルのDLで実際にアプリから追放されることを実機確認。

## Minor Observations
「users」表記のみ英語。インストールコマンドOS選択が記憶されない。装飾アイコンにaria-hidden不足。

## Questions to Consider
MCP連携をナビから外したら価値は伝わるか。ダウンロード時の防御をサーバー側投稿時検証に倒せるか。
