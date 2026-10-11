/api/auth 配下は素通し。それ以外は Bearer トークン、/api/mcp のクエリトークン、セッション Cookie の順に検証する。失敗時は 401。
