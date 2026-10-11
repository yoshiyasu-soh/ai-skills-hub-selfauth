worker/src/index.ts。/api/* に secureHeaders (CSP default-src none 等) を付け、/api/auth 以外へ authMiddleware を適用し、各ルートをマウントする。onError で本番は内部エラー文を隠す。
