D1 では PRAGMA foreign_keys = OFF が効かないため、items など親テーブルの再構築時は子テーブルの退避・復元が必須 (CLAUDE.md ルール2)。適用済みマイグレーションは書き換えず、新しい番号で追加する。機密情報は wrangler secret で設定する。
