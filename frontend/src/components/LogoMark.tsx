interface LogoMarkProps {
  className?: string;
}

// 「コマンドプロンプト」(">_")をモチーフにしたロゴマーク。
// 地色/差し色はライト・ダークで反転する(ライト: 黒地にライム、ダーク: ライム地に黒)。
// 色は logo-bg / logo-fg トークン(tailwind.config.js)経由でテーマに追従する。
export default function LogoMark({ className = "h-8 w-8" }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="AI Skills Hub">
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-logo-bg" />
      <path
        d="M9 12l5 4-5 4"
        className="stroke-logo-fg"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M17 21h6" className="stroke-logo-fg" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
