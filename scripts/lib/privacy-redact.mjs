/**
 * Privacy helpers for weekly articles drafted from 広報 extracts.
 * Portable contract: never put private-person names or mobile numbers in posts.
 */

/** JP mobile (070 / 080 / 090), with or without separators. */
export const MOBILE_RE =
  /(?<!\d)0[7-9]0(?:[-‐−–—.\s]?\d{4}[-‐−–—.\s]?\d{4}|\d{8})(?!\d)/gu;

/**
 * @param {string} text
 * @returns {{ match: string, index: number }[]}
 */
export function findMobileNumbers(text) {
  const out = [];
  const re = new RegExp(MOBILE_RE.source, MOBILE_RE.flags);
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ match: m[0], index: m.index });
  }
  return out;
}

/**
 * Replace mobile numbers with a placeholder (for extract sanitization / previews).
 * @param {string} text
 * @param {string} [replacement='[携帯番号を削除]']
 */
export function redactMobileNumbers(text, replacement = '[携帯番号を削除]') {
  return text.replace(new RegExp(MOBILE_RE.source, MOBILE_RE.flags), replacement);
}

/**
 * Contact-line guidance for agents (not applied mechanically to names).
 * Private-person names cannot be reliably detected; draft-prompt rules cover that.
 */
export const PRIVACY_DRAFT_RULES = {
  mobiles: '記事本文に 070 / 080 / 090 の携帯電話番号を書かない',
  privateNames:
    '私人の氏名（住民・実行委員個人・園児など）を記事に書かない。問い合わせは部署・団体名＋固定電話のみ',
  publicOfficialsOk:
    '公職の肩書付き引用（例: 市長の公式発言）は広報に基づく場合に限り可',
};
