import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import {
  useListHabits,
  useListCompletions,
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useCompleteHabit,
  useUncompleteHabit,
  useGetStats,
} from "@workspace/api-client-react";

import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { offlineStore } from "@/lib/offline-storage";

import {
  Habit,
  HabitCompletion,
  CreateHabitRequest,
  UpdateHabitRequest,
} from "@workspace/api-client-react/src/generated/api.schemas";

export function useHabitsData(date: Date = new Date()) {
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const dateStr = format(date, "yyyy-MM-dd");

  // ─────────────────────────────────────────
  // LOCAL SOURCE OF TRUTH (ÚNICO ESTADO REAL)
  // ─────────────────────────────────────────
  const [localHabits, setLocalHabits] = useState<Habit[]>(() =>
    offlineStore.loadHabits()
  );

  const [localCompletions, setLocalCompletions] = useState<HabitCompletion[]>(() =>
    offlineStore.loadCompletions(dateStr)
  );

  // ─────────────────────────────────────────
  // SERVER (APENAS SINCRONIZAÇÃO)
  // ─────────────────────────────────────────
  const habitsQuery = useListHabits({ query: { enabled: isOnline } });
  const completionsQuery = useListCompletions(
    { from: dateStr, to: dateStr },
    { query: { enabled: isOnline } }
  );

  // ─────────────────────────────────────────
  // SYNC SERVER → LOCAL (SEM SOBRESCREVER LOCAL)
  // ─────────────────────────────────────────
  useEffect(() => {
    if (habitsQuery.data) {
      offlineStore.saveHabits(habitsQuery.data);

      const local = offlineStore.loadHabits();
      if (local.length === 0) {
        setLocalHabits(habitsQuery.data);
      }
    }
  }, [habitsQuery.data]);

  useEffect(() => {
    if (completionsQuery.data) {
      offlineStore.saveCompletions(dateStr, completionsQuery.data);
      setLocalCompletions(completionsQuery.data);
    }
  }, [completionsQuery.data, dateStr]);

  // ─────────────────────────────────────────
  // MUTATIONS
  // ─────────────────────────────────────────
  const createMut = useCreateHabit();
  const updateMut = useUpdateHabit();
  const deleteMut = useDeleteHabit();
  const completeMut = useCompleteHabit();
  const uncompleteMut = useUncompleteHabit();

  // ─────────────────────────────────────────
  // CREATE (OFFLINE-FIRST CORRETO)
  // ─────────────────────────────────────────
  const createHabit = useCallback((payload: CreateHabitRequest) => {
    const tempHabit: Habit = {
      id: Date.now(),
      name: payload.name,
      icon: payload.icon ?? "💧",
      color: payload.color ?? "Indigo",
      frequency: payload.frequency ?? "daily",
      targetCount: payload.targetCount ?? 1,
      streak: 0,
      totalCompletions: 0,
      createdAt: new Date().toISOString(),
    };

    const updated = [...offlineStore.loadHabits(), tempHabit];

    offlineStore.addHabitLocally(tempHabit);
    setLocalHabits(updated);

    if (isOnline) {
      createMut.mutate({ data: payload });
    } else {
      offlineStore.enqueue({ type: "create", payload });
      toast({
        title: "Hábito salvo localmente",
        description: "Sincroniza quando voltar online",
      });
    }
  }, [isOnline]);

  // ─────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────
  const deleteHabit = useCallback(({ id }: { id: number }) => {
    const updated = offlineStore
      .loadHabits()
      .filter((h) => h.id !== id);

    offlineStore.removeHabitLocally(id);
    setLocalHabits(updated);

    if (isOnline) {
      deleteMut.mutate({ id });
    } else {
      offlineStore.enqueue({ type: "delete", habitId: id });
    }
  }, [isOnline]);

  // ─────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────
  const updateHabit = useCallback(({ id, data }: { id: number; data: UpdateHabitRequest }) => {
    offlineStore.updateHabitLocally(id, data as any);
    setLocalHabits(offlineStore.loadHabits());

    if (isOnline) {
      updateMut.mutate({ id, data });
    } else {
      offlineStore.enqueue({ type: "update", habitId: id, payload: data });
    }
  }, [isOnline]);

  // ─────────────────────────────────────────
  // TOGGLE COMPLETION
  // ─────────────────────────────────────────
  const toggleCompletion = useCallback(
    (habitId: number, isCompleted: boolean) => {
      if (isCompleted) {
        offlineStore.removeCompletionLocally(dateStr, habitId);
      } else {
        offlineStore.addCompletionLocally(dateStr, habitId);
      }

      setLocalCompletions(offlineStore.loadCompletions(dateStr));

      if (isOnline) {
        if (isCompleted) {
          uncompleteMut.mutate({ id: habitId, data: { date: dateStr } });
        } else {
          completeMut.mutate({ id: habitId, data: { date: dateStr } });
        }
      }
    },
    [isOnline, dateStr]
  );

  // ─────────────────────────────────────────
  // DERIVED STATE
  // ─────────────────────────────────────────
  const completedHabitIds = new Set(
    localCompletions.map((c) => c.habitId)
  );

  return {
    habits: localHabits,
    isLoading: isOnline ? habitsQuery.isLoading : false,
    completedHabitIds,
    toggleCompletion,
    createHabit,
    updateHabit,
    deleteHabit,
    isCreating: createMut.isPending,
    isUpdating: updateMut.isPending,
  };
}

export function useHabitStats() {
  return useGetStats();
}
