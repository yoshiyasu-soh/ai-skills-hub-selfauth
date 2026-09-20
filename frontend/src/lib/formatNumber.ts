/** GitHubのスター数などを "1.2k" のようにコンパクトに表示する */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}
