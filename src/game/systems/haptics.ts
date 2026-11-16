/** Web-to-native haptic bridge. iOS Safari/WKWebView does not support
 * navigator.vibrate, so the native WebView host must handle these messages.
 * No haptics are emitted for incidental physics collisions. */
export type HapticKind = 'place' | 'clear' | 'grid';

interface NativeWindow extends Window {
  ReactNativeWebView?: { postMessage: (message: string) => void };
  webkit?: { messageHandlers?: { tsumimacHaptics?: { postMessage: (message: unknown) => void } } };
}

export function triggerHaptic(kind: HapticKind, strength: number): void {
  if (typeof window === 'undefined') return;
  const host = window as NativeWindow;
  const payload = { type: 'tsumimac:haptic', kind, strength };
  try {
    if (host.ReactNativeWebView?.postMessage) {
      host.ReactNativeWebView.postMessage(JSON.stringify(payload));
      return;
    }
    if (host.webkit?.messageHandlers?.tsumimacHaptics?.postMessage) {
      host.webkit.messageHandlers.tsumimacHaptics.postMessage(payload);
      return;
    }
    // Android/other browsers only. iOS ignores vibrate().
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(kind === 'grid' ? 10 : kind === 'clear' ? (strength >= 2 ? [180, 60, 200] : 180) : 35);
    }
  } catch {
    // Haptics are optional and must never interrupt gameplay.
  }
}
