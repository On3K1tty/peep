interface TelegramWebApp {
  ready(): void;
  expand(): void;
  close(): void;
  MainButton: {
    text: string;
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
  };
  BackButton: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
  };
  HapticFeedback: {
    impactOccurred(style: string): void;
    notificationOccurred(type: string): void;
  };
  sendData(data: string): void;
  openTelegramLink(url: string): void;
  CloudStorage: any;
}

function getTG(): TelegramWebApp | null {
  return (window as any).Telegram?.WebApp ?? null;
}

export function tgInit() {
  const tg = getTG();
  if (tg) {
    tg.ready();
    tg.expand();
  }
}

export function tgHaptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  getTG()?.HapticFeedback?.impactOccurred(type);
}

export function tgShare(url: string) {
  const tg = getTG();
  if (tg) {
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}`);
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard?.writeText(url);
  }
}

export function tgBackButton(show: boolean, onClick?: () => void) {
  const tg = getTG();
  if (!tg) return;
  if (show) {
    tg.BackButton.show();
    if (onClick) tg.BackButton.onClick(onClick);
  } else {
    tg.BackButton.hide();
  }
}

export function isTG(): boolean {
  return !!(window as any).Telegram?.WebApp;
}
