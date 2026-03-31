import { useEffect, useCallback } from "react";
import { Habit } from "@workspace/api-client-react/src/generated/api.schemas";

export function useReminders(habits: Habit[]) {
  // Schedule reminders in the service worker whenever habits change
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) {
        reg.active.postMessage({
          type: "SCHEDULE_REMINDERS",
          habits: habits.map((h) => ({
            id: h.id,
            name: h.name,
            icon: h.icon,
            reminderTime: (h as any).reminderTime ?? null,
          })),
        });
      }
    });
  }, [habits]);
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
