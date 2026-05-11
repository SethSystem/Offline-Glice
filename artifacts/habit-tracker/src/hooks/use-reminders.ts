import { useEffect, useCallback } from "react";
import type { Habit } from "@/lib/types";

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
    const updated = { [today]: [...(stored[today] || []), String(habitId)] };
    localStorage.setItem(FIRED_KEY, JSON.stringify(updated));
  } catch {}
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [0, 0.35, 0.7].forEach((startOffset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.6, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + startOffset + 0.28
      );
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + 0.3);
    });
  } catch {}
}

async function fireNotification(habit: Habit) {
  const title = `${habit.icon} ${habit.name}`;
  const body = "Hora de marcar esse hábito como concluído! ✅";
  const icon = "/favicon.svg";

  playBeep();

  if ("serviceWorker" in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("SW timeout")), 3000)
        ),
      ]);
      await (reg as ServiceWorkerRegistration).showNotification(title, {
        body,
        icon,
        badge: icon,
        tag: `reminder-${habit.id}`,
        requireInteraction: false,
      });
      return;
    } catch {}
  }

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon, tag: `reminder-${habit.id}` });
    } catch {}
  }
}

export function useReminders(habits: Habit[]) {
  const checkReminders = useCallback(async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const habitsWithReminders = habits.filter((h) => h.reminderTime);
    if (habitsWithReminders.length === 0) return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const fired = getTodayFired();

    for (const habit of habitsWithReminders) {
      const normalized = (habit.reminderTime as string).slice(0, 5);
      if (normalized === currentTime && !fired.has(String(habit.id))) {
        markFired(habit.id);
        await fireNotification(habit);
      }
    }
  }, [habits]);

  useEffect(() => {
    checkReminders();
    const interval = setInterval(checkReminders, 20_000);
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
