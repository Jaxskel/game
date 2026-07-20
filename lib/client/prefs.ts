"use client";

/**
 * Local preferences. Public reading requires no account — follows, theme,
 * onboarding state, and notification preferences live in localStorage only.
 * Notification *delivery* requires the production push service (BLOCKED in
 * demo); these are preferences, honestly labeled as such in the UI.
 */

export interface FollowedTopic {
  kind: "country" | "region" | "conflict" | "address-channel" | "topic";
  id: string;
  label: string;
}

export interface NotificationPrefs {
  majorDevelopments: boolean;
  officialAddresses: boolean;
  briefingReady: boolean;
  dailyDigest: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
  level: "high-significance" | "all-corroborated";
}

export type Theme = "system" | "light" | "dark";

const KEYS = {
  theme: "gcm.theme",
  follows: "gcm.follows",
  notifications: "gcm.notifications",
  onboarded: "gcm.onboarded",
  recentSearches: "gcm.recentSearches",
  savedIncidents: "gcm.savedIncidents",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode); prefs simply don't persist.
  }
}

export const prefs = {
  getTheme: (): Theme => read<Theme>(KEYS.theme, "system"),
  setTheme(theme: Theme) {
    write(KEYS.theme, theme);
    applyTheme(theme);
  },

  getFollows: (): FollowedTopic[] => read(KEYS.follows, []),
  setFollows: (follows: FollowedTopic[]) => write(KEYS.follows, follows),
  toggleFollow(topic: FollowedTopic): FollowedTopic[] {
    const follows = prefs.getFollows();
    const exists = follows.some((f) => f.kind === topic.kind && f.id === topic.id);
    const next = exists
      ? follows.filter((f) => !(f.kind === topic.kind && f.id === topic.id))
      : [...follows, topic];
    prefs.setFollows(next);
    return next;
  },

  getNotifications: (): NotificationPrefs =>
    read(KEYS.notifications, {
      majorDevelopments: true,
      officialAddresses: false,
      briefingReady: false,
      dailyDigest: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      level: "high-significance",
    }),
  setNotifications: (p: NotificationPrefs) => write(KEYS.notifications, p),

  isOnboarded: (): boolean => read(KEYS.onboarded, false),
  setOnboarded: (v: boolean) => write(KEYS.onboarded, v),

  getRecentSearches: (): string[] => read(KEYS.recentSearches, []),
  addRecentSearch(q: string) {
    const list = prefs.getRecentSearches().filter((s) => s !== q);
    write(KEYS.recentSearches, [q, ...list].slice(0, 8));
  },
  clearRecentSearches: () => write(KEYS.recentSearches, []),

  getSavedIncidents: (): string[] => read(KEYS.savedIncidents, []),
  toggleSavedIncident(id: string): string[] {
    const saved = prefs.getSavedIncidents();
    const next = saved.includes(id) ? saved.filter((s) => s !== id) : [...saved, id];
    write(KEYS.savedIncidents, next);
    return next;
  },

  clearAll() {
    for (const key of Object.values(KEYS)) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  },
};

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
