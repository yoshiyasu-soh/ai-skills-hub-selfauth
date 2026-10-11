worker/src/lib/auth/。password (ハッシュ)、session (Cookie と sessions テーブル)、tokens (ハッシュ化)、rateLimit (auth_attempts による 15 分窓の上限。IP 単位の上限も持つ)、registration (登録モードとドメイン制限)、turnstile (Siteverify)。
