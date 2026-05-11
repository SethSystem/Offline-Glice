import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  useListHabits,
  useListCompletions,
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useCompleteHabit,
  useUncompleteHabit,
  useGetStats,
  getListCompletionsQueryKey,
  getListHabitsQueryKey,
  getGetStatsQueryKey,
} from "@workspace/api-client-react";
import type {
  Habit,
  HabitCompletion,
  CreateHabitRequest,
  UpdateHabitRequest,
  StatsResponse,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { offlineStore, QueuedOp } from "@/lib/offline-storage";

// ── Local stats calculator (offline fallback) ────────────────────────────────
function buildLocalStats(): StatsResponse {
  const habits = offlineStore.loadHabits();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const last30 = Array.from({ length: 30 }, (_, i) =>
    format(subDays(today, 29 - i), "yyyy-MM-dd")
  );

  // Load cached completions for each day
  const completionsByDate: Record<string, number[]> = {};
  for (const dateStr of last30) {
    completionsByDate[dateStr] = offlineStore
      .loadCompletions(dateStr)
      .map((c) => c.habitId);
  }

  const todayIds = completionsByDate[todayStr] ?? [];

  const habitStats = habits.map((habit) => {
    const weeklyData = last30.map((date) => ({
      date,
      completed: (completionsByDate[date] ?? []).includes(habit.id),
    }));
    const completedDays = weeklyData.filter((d) => d.completed).length;
    return {
      habitId: habit.id,
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      streak: habit.streak,
      longestStreak: habit.streak,
      totalCompletions: habit.totalCompletions,
      completionRate: last30.length > 0 ? completedDays / last30.length : 0,
      weeklyData,
    };
  });

  const longestStreakEver = habits.reduce(
    (max, h) => Math.max(max, h.streak),
    0
  );

  // Simple local insights
  const insights: string[] = [];
  if (habits.length === 0) {
    insights.push("Crie seu primeiro hábito para começar a acompanhar seu progresso.");
  } else {
    const best = habitStats.sort((a, b) => b.completionRate - a.completionRate)[0];
    if (best && best.completionRate > 0) {
      insights.push(
        `Seu hábito mais consistente é "${best.name}" com ${Math.round(best.completionRate * 100)}% de conclusão nos últimos 30 dias.`
      );
    }
    if (longestStreakEver >= 7) {
      insights.push(`Incrível! Você manteve uma sequência de ${longestStreakEver} dias. Continue assim!`);
    }
    if (todayIds.length === habits.length && habits.length > 0) {
      insights.push("Parabéns! Você concluiu todos os hábitos de hoje. 🎉");
    } else if (todayIds.length === 0 && habits.length > 0) {
      insights.push("Você ainda não marcou nenhum hábito hoje. Vamos lá!");
    }
  }

  return {
    totalHabits: habits.length,
    completedToday: todayIds.length,
    longestStreakEver,
    insights,
    habitStats,
  };
}

// ── Queue flusher ─────────────────────────────────────────────────────────────
async function flushQueue(
  ops: QueuedOp[],
  mutations: {
    complete: (id: number, date: string) => Promise<void>;
    uncomplete: (id: number, date: string) => Promise<void>;
    create: (payload: any) => Promise<void>;
    del: (id: number) => Promise<void>;
    update: (id: number, payload: any) => Promise<void>;
  }
) {
  for (const op of ops) {
    try {
      if (op.type === "complete") await mutations.complete(op.habitId, op.date);
      else if (op.type === "uncomplete") await mutations.uncomplete(op.habitId, op.date);
      else if (op.type === "create") await mutations.create(op.payload);
      else if (op.type === "delete") await mutations.del(op.habitId);
      else if (op.type === "update") await mutations.update(op.habitId, op.payload);
      offlineStore.dequeue(op.id);
    } catch {
      // Keep in queue for next attempt
    }
  }
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useHabitsData(date: Date = new Date()) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const dateStr = format(date, "yyyy-MM-dd");
  const prevOnlineRef = useRef(isOnline);

  const [localHabits, setLocalHabits] = useState<Habit[]>(() => offlineStore.loadHabits());
  const [localCompletions, setLocalCompletions] = useState<HabitCompletion[]>(
    () => offlineStore.loadCompletions(dateStr)
  );
  const [apiReachable, setApiReachable] = useState(true);

  const habitsQuery = useListHabits({
    query: { enabled: isOnline, retry: 1 } as any,
  });
  const completionsQuery = useListCompletions(
    { from: dateStr, to: dateStr },
    { query: { enabled: isOnline, retry: 1 } as any }
  );

  useEffect(() => {
    if (habitsQuery.data) {
      offlineStore.saveHabits(habitsQuery.data);
      setLocalHabits(habitsQuery.data);
      setApiReachable(true);
    }
  }, [habitsQuery.data]);

  useEffect(() => {
    if (completionsQuery.data) {
      offlineStore.saveCompletions(dateStr, completionsQuery.data);
      setLocalCompletions(completionsQuery.data);
    }
  }, [completionsQuery.data, dateStr]);

  useEffect(() => {
    if (habitsQuery.isError) {
      setApiReachable(false);
      const cached = offlineStore.loadHabits();
      if (cached.length > 0) setLocalHabits(cached);
    }
  }, [habitsQuery.isError]);

  useEffect(() => {
    if (completionsQuery.isError) {
      setLocalCompletions(offlineStore.loadCompletions(dateStr));
    }
  }, [completionsQuery.isError, dateStr]);

  useEffect(() => {
    setLocalCompletions(
      completionsQuery.data ?? offlineStore.loadCompletions(dateStr)
    );
  }, [dateStr]);

  const effectivelyOnline = isOnline && apiReachable;

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCompletionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
  }, [queryClient]);

  const completeMut = useCompleteHabit({ mutation: { onSuccess: invalidateAll } });
  const uncompleteMut = useUncompleteHabit({ mutation: { onSuccess: invalidateAll } });
  const createMut = useCreateHabit({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Hábito criado!", description: "Vamos começar essa nova jornada." });
      },
    },
  });
  const updateMut = useUpdateHabit({ mutation: { onSuccess: invalidateAll } });
  const deleteMut = useDeleteHabit({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Hábito excluído" });
      },
    },
  });

  const rawMutations = {
    complete: (id: number, d: string) =>
      new Promise<void>((res, rej) =>
        completeMut.mutate({ id, data: { date: d } }, { onSuccess: () => res(), onError: rej })
      ),
    uncomplete: (id: number, d: string) =>
      new Promise<void>((res, rej) =>
        uncompleteMut.mutate({ id, data: { date: d } }, { onSuccess: () => res(), onError: rej })
      ),
    create: (payload: CreateHabitRequest) =>
      new Promise<void>((res, rej) =>
        createMut.mutate({ data: payload }, { onSuccess: () => res(), onError: rej })
      ),
    del: (id: number) =>
      new Promise<void>((res, rej) =>
        deleteMut.mutate({ id }, { onSuccess: () => res(), onError: rej })
      ),
    update: (id: number, payload: UpdateHabitRequest) =>
      new Promise<void>((res, rej) =>
        updateMut.mutate({ id, data: payload }, { onSuccess: () => res(), onError: rej })
      ),
  };

  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      setApiReachable(true);
      const queue = offlineStore.getQueue();
      if (queue.length > 0) {
        toast({ title: "Sincronizando...", description: `${queue.length} ação(ões) pendente(s).` });
        flushQueue(queue, rawMutations).then(() => {
          invalidateAll();
          const remaining = offlineStore.getQueue();
          if (remaining.length === 0) {
            toast({ title: "Sincronizado!", description: "Tudo salvo no servidor." });
          }
        });
      }
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  const toggleCompletion = useCallback(
    (habitId: number, isCompleted: boolean) => {
      const applyLocally = () => {
        if (isCompleted) {
          offlineStore.removeCompletionLocally(dateStr, habitId);
          offlineStore.enqueue({ type: "uncomplete", habitId, date: dateStr } as any);
        } else {
          offlineStore.addCompletionLocally(dateStr, habitId);
          offlineStore.enqueue({ type: "complete", habitId, date: dateStr } as any);
        }
        setLocalCompletions(offlineStore.loadCompletions(dateStr));
        setLocalHabits(offlineStore.loadHabits());
      };

      if (effectivelyOnline) {
        if (isCompleted) {
          uncompleteMut.mutate(
            { id: habitId, data: { date: dateStr } },
            { onError: () => { setApiReachable(false); applyLocally(); } }
          );
        } else {
          completeMut.mutate(
            { id: habitId, data: { date: dateStr } },
            { onError: () => { setApiReachable(false); applyLocally(); } }
          );
        }
      } else {
        applyLocally();
      }
    },
    [effectivelyOnline, dateStr]
  );

  const createHabit = useCallback(
    (payload: CreateHabitRequest) => {
      const applyLocally = () => {
        const tempHabit: Habit = {
          id: -Date.now(),
          name: payload.name,
          icon: payload.icon ?? "💧",
          color: payload.color ?? "Indigo",
          frequency: payload.frequency ?? "daily",
          targetCount: payload.targetCount ?? 1,
          streak: 0,
          longestStreak: 0,
          totalCompletions: 0,
          createdAt: new Date().toISOString(),
        };
        offlineStore.addHabitLocally(tempHabit);
        offlineStore.enqueue({ type: "create", payload } as any);
        setLocalHabits(offlineStore.loadHabits());
        toast({ title: "Hábito salvo localmente", description: "Vai sincronizar quando voltar a internet." });
      };

      if (effectivelyOnline) {
        createMut.mutate(
          { data: payload },
          { onError: () => { setApiReachable(false); applyLocally(); } }
        );
      } else {
        applyLocally();
      }
    },
    [effectivelyOnline]
  );

  const deleteHabit = useCallback(
    ({ id }: { id: number }) => {
      if (effectivelyOnline) {
        deleteMut.mutate(
          { id },
          {
            onError: () => {
              setApiReachable(false);
              offlineStore.removeHabitLocally(id);
              offlineStore.enqueue({ type: "delete", habitId: id } as any);
              setLocalHabits(offlineStore.loadHabits());
            },
          }
        );
      } else {
        offlineStore.removeHabitLocally(id);
        offlineStore.enqueue({ type: "delete", habitId: id } as any);
        setLocalHabits(offlineStore.loadHabits());
        toast({ title: "Hábito removido localmente" });
      }
    },
    [effectivelyOnline]
  );

  const updateHabit = useCallback(
    ({ id, data }: { id: number; data: UpdateHabitRequest }) => {
      if (effectivelyOnline) {
        updateMut.mutate(
          { id, data },
          {
            onError: () => {
              setApiReachable(false);
              offlineStore.updateHabitLocally(id, data as Partial<Habit>);
              offlineStore.enqueue({ type: "update", habitId: id, payload: data } as any);
              setLocalHabits(offlineStore.loadHabits());
            },
          }
        );
      } else {
        offlineStore.updateHabitLocally(id, data as Partial<Habit>);
        offlineStore.enqueue({ type: "update", habitId: id, payload: data } as any);
        setLocalHabits(offlineStore.loadHabits());
        toast({ title: "Hábito atualizado localmente" });
      }
    },
    [effectivelyOnline]
  );

  const completedHabitIds = new Set(localCompletions.map((c) => c.habitId));
  const isLoading =
    isOnline && apiReachable
      ? habitsQuery.isLoading && localHabits.length === 0
      : false;

  return {
    habits: localHabits,
    isLoading,
    isOnline: effectivelyOnline,
    completedHabitIds,
    toggleCompletion,
    createHabit,
    updateHabit,
    deleteHabit,
    isCreating: createMut.isPending,
    isUpdating: updateMut.isPending,
  };
}

// ── Stats hook — API com fallback local ──────────────────────────────────────
export function useHabitStats() {
  const statsQuery = useGetStats();
  const [localStats, setLocalStats] = useState<StatsResponse | null>(null);

  // Quando a API falha, calcula localmente
  useEffect(() => {
    if (statsQuery.isError || (!statsQuery.isLoading && !statsQuery.data)) {
      setLocalStats(buildLocalStats());
    }
  }, [statsQuery.isError, statsQuery.isLoading, statsQuery.data]);

  // Atualiza stats locais quando hábitos mudam no localStorage
  useEffect(() => {
    if (!statsQuery.data) {
      setLocalStats(buildLocalStats());
    }
  }, []);

  return {
    ...statsQuery,
    data: statsQuery.data ?? localStats ?? undefined,
    isLoading: statsQuery.isLoading && !localStats,
  };
}
