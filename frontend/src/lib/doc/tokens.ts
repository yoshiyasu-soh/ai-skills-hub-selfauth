/**
 * トークン数の推定値。トークナイザは同梱せず、非ASCII文字は1文字≒1トークン、
 * ASCII文字は4文字≒1トークンとして概算する(参照用の目安であり厳密値ではない)。
 */
export function estimateTokens(text: string): number {
  let ascii = 0;
  let other = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) < 0x80) ascii++;
    else other++;
  }
  return Math.ceil(ascii / 4) + other;
}
