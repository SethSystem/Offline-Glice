import { useState, useCallback } from "react";
import { format } from "date-fns";
import { store } from "@/lib/store";
import type { Habit, CreateHabitRequest, UpdateHabitRequest } from "@/lib/types";

export function useHabitsData(date: Date = new Date()) {
  const dateStr = format(date, "yyyy-MM-dd");

  const [habits, setHabits] = useState<Habit[]>(() => store.loadHabits());
  const [completedHabitIds, setCompletedHabitIds] = useState<Set<number>>(
    () => new Set(store.loadCompletions(dateStr).map((c) => c.habitId))
  );

  const refresh = useCallback(() => {
    setHabits(store.loadHabits());
    setCompletedHabitIds(
      new Set(store.loadCompletions(dateStr).map((c) => c.habitId))
    );
  }, [dateStr]);

  const toggleCompletion = useCallback(
    (habitId: number, isCompleted: boolean) => {
      if (isCompleted) {
        store.removeCompletion(dateStr, habitId);
      } else {
        store.addCompletion(dateStr, habitId);
      }
      refresh();
    },
    [dateStr, refresh]
  );

  const createHabit = useCallback(
    (payload: CreateHabitRequest) => {
      store.createHabit(payload);
      refresh();
    },
    [refresh]
  );

  const updateHabit = useCallback(
    ({ id, data }: { id: number; data: UpdateHabitRequest }) => {
      store.updateHabit(id, data);
      refresh();
    },
    [refresh]
  );

  const deleteHabit = useCallback(
    ({ id }: { id: number }) => {
      store.deleteHabit(id);
      refresh();
    },
    [refresh]
  );

  return {
    habits,
    isLoading: false,
    isOnline: true,
    completedHabitIds,
    toggleCompletion,
    createHabit,
    updateHabit,
    deleteHabit,
    isCreating: false,
    isUpdating: false,
  };
}

export function useHabitStats() {
  const today = format(new Date(), "yyyy-MM-dd");
  return {
    data: store.buildStats(today),
    isLoading: false,
    isError: false,
  };
}
