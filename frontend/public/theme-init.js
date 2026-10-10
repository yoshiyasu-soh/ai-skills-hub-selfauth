// React がハイドレートする前にテーマを確定させ、切り替わりのちらつき(FOUC)を防ぐ。
// ThemeContext(src/lib/ThemeContext.tsx)と同じ判定順(手動保存 > OS設定 > light)。
// CSP(public/_headers)でインラインスクリプトを禁止しているため、index.html に直接書かず別ファイルにしている。
(function () {
  try {
    var stored = localStorage.getItem("ai-skills-hub-theme");
    var theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
