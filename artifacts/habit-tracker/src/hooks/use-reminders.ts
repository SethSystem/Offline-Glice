import { useEffect, useCallback } from "react";
import { Habit } from "@workspace/api-client-react/src/generated/api.schemas";

// Track which reminders already fired today to avoid duplicates
const FIRED_KEY = "hf:reminders:fired";

function getTodayFired(): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
    const today = new Date().toISOString().split("T")[0];
    return new Set(stored[today] || []);
  } catch {
    return new Set();
  }
}

function markFired(habitId: number) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const stored = JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
    // Keep only today's entries to avoid growing forever
    const updated = { [today]: [...(stored[today] || []), String(habitId)] };
    localStorage.setItem(FIRED_KEY, JSON.stringify(updated));
  } catch {}
}

async function fireNotification(habit: Habit) {
  // Try service worker notification first (shows even when minimized)
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(`${habit.icon} ${habit.name}`, {
      body: "Hora de registrar esse hábito! Abra o app e marque como concluído ✅",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: `reminder-${habit.id}`,
      renotify: true,
      requireInteraction: false,
      data: { url: "/" },
    });
    return;
  }
  // Fallback: regular Notification API
  if (Notification.permission === "granted") {
    new Notification(`${habit.icon} ${habit.name}`, {
      body: "Hora de registrar esse hábito! Abra o app e marque como concluído ✅",
      icon: "/favicon.svg",
      tag: `reminder-${habit.id}`,
    });
  }
}

export function useReminders(habits: Habit[]) {
  const checkReminders = useCallback(async () => {
    if (Notification.permission !== "granted") return;
    const habitsWithReminders = habits.filter((h) => (h as any).reminderTime);
    if (habitsWithReminders.length === 0) return;

    const now = new Date();
    const currentHH = String(now.getHours()).padStart(2, "0");
    const currentMM = String(now.getMinutes()).padStart(2, "0");
    const currentTime = `${currentHH}:${currentMM}`;
    const fired = getTodayFired();

    for (const habit of habitsWithReminders) {
      const reminderTime = (habit as any).reminderTime as string;
      if (reminderTime === currentTime && !fired.has(String(habit.id))) {
        markFired(habit.id);
        await fireNotification(habit);
      }
    }
  }, [habits]);

  useEffect(() => {
    // Check immediately on mount (in case we just opened at the right time)
    checkReminders();

    // Then check every 30 seconds for accuracy
    const interval = setInterval(checkReminders, 30_000);
    return () => clearInterval(interval);
  }, [checkReminders]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}
