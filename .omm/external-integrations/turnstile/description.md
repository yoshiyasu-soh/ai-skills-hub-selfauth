登録とパスワード再設定申請のボット対策。TURNSTILE_SITE_KEY を設定すると有効になり、検証できないリクエストはすべて拒否する (fail-closed)。画面側は TurnstileWidget.tsx、CSP は challenges.cloudflare.com を許可している。
