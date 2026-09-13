import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Routerはページ遷移時にスクロール位置を保持したままにするため、
 * 何もしないと「前のページで下までスクロールした状態」のままリンク先が表示されてしまう。
 * ハッシュ付き遷移(例: /guide#faq)はアンカー側の処理に任せ、ここでは何もしない。
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
