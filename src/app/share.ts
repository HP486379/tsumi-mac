import { formatYen } from '../data/devices';
import type { ScoreSnapshot } from '../game/systems/scoring';

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function buildShareText(s: ScoreSnapshot, url?: string): string {
  const lines = [
    '【積みMac — STACK YOUR MAC】',
    '買って満足。積んで絶望。',
    `散財総額：${formatYen(s.spent)}`,
    `整理額：${formatYen(s.cleared)}`,
    `積みMac指数：${formatYen(s.fieldValue)}`,
    `整理行数：${s.lines}行 / 最大コンボ：${s.maxCombo}`,
    `プレイ時間：${formatTime(s.timeMs)}`,
    '起動したMac：0台',
    '#積みMac',
  ];
  if (url) lines.push(url);
  return lines.join('\n');
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Web Share API → Clipboard API → execCommand の順でフォールバック */
export async function shareText(text: string, nav: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined): Promise<ShareResult> {
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title: '積みMac — STACK YOUR MAC', text });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // それ以外はクリップボードへフォールバック
    }
  }
  if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      await nav.clipboard.writeText(text);
      return 'copied';
    } catch {
      /* fallthrough */
    }
  }
  if (typeof document !== 'undefined') {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) return 'copied';
    } catch {
      /* noop */
    }
  }
  return 'failed';
}
