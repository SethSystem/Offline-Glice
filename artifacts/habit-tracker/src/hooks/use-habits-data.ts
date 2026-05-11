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
  getListCompletionsQueryKey,
  getListHabitsQueryKey,
  getGetStatsQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { offlineStore, QueuedOp } from "@/lib/offline-storage";
import { Habit, HabitCompletion, CreateHabitRequest, UpdateHabitRequest } from "@workspace/api-client-react/src/generated/api.schemas";

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

  // ── Local (offline) state — always initialized from localStorage ──
  const [localHabits, setLocalHabits] = useState<Habit[]>(() => offlineStore.loadHabits());
  const [localCompletions, setLocalCompletions] = useState<HabitCompletion[]>(
    () => offlineStore.loadCompletions(dateStr)
  );

  // Track whether we have fresh server data (API reachable)
  const [apiReachable, setApiReachable] = useState(true);

  // ── Server queries — always enabled, offline fallback on error ──
  const habitsQuery = useListHabits({
    query: {
      enabled: isOnline,
      retry: 1,
      staleTime: 30_000,
    },
  });
  const completionsQuery = useListCompletions(
    { from: dateStr, to: dateStr },
    {
      query: {
        enabled: isOnline,
        retry: 1,
        staleTime: 30_000,
      },
    }
  );

  // ── Persist to localStorage when server responds ──
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

  // ── When API fails (even if technically online), fall back to localStorage ──
  useEffect(() => {
    if (habitsQuery.isError) {
      setApiReachable(false);
      const cached = offlineStore.loadHabits();
      if (cached.length > 0) setLocalHabits(cached);
    }
  }, [habitsQuery.isError]);

  useEffect(() => {
    if (completionsQuery.isError) {
      const cached = offlineStore.loadCompletions(dateStr);
      setLocalCompletions(cached);
    }
  }, [completionsQuery.isError, dateStr]);

  // ── Load from localStorage when date changes ──
  useEffect(() => {
    setLocalCompletions(
      completionsQuery.data ?? offlineStore.loadCompletions(dateStr)
    );
  }, [dateStr]);

  // ── Effective online = has network AND API is reachable ──
  const effectivelyOnline = isOnline && apiReachable;

  // ── Invalidate helpers ──
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCompletionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
  }, [queryClient]);

  // ── Raw mutations (used both directly and by queue flusher) ──
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

  // ── Async wrappers for flusher ──
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

  // ── Flush pending queue when coming back online ──
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      // Re-check API reachability when network comes back
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

  // ── Public toggle (offline-aware) ──
  const toggleCompletion = useCallback(
    (habitId: number, isCompleted: boolean) => {
      if (effectivelyOnline) {
        if (isCompleted) {
          uncompleteMut.mutate(
            { id: habitId, data: { date: dateStr } },
            {
              onError: () => {
                // API failed mid-session — fall back to local
                setApiReachable(false);
                if (isCompleted) {
                  offlineStore.removeCompletionLocally(dateStr, habitId);
                  offlineStore.enqueue({ type: "uncomplete", habitId, date: dateStr });
                } else {
                  offlineStore.addCompletionLocally(dateStr, habitId);
                  offlineStore.enqueue({ type: "complete", habitId, date: dateStr });
                }
                setLocalCompletions(offlineStore.loadCompletions(dateStr));
              },
            }
          );
        } else {
          completeMut.mutate(
            { id: habitId, data: { date: dateStr } },
            {
              onError: () => {
                setApiReachable(false);
                offlineStore.addCompletionLocally(dateStr, habitId);
                offlineStore.enqueue({ type: "complete", habitId, date: dateStr });
                setLocalCompletions(offlineStore.loadCompletions(dateStr));
                setLocalHabits(offlineStore.loadHabits());
              },
            }
          );
        }
      } else {
        // Offline or API unreachable — apply locally + enqueue
        if (isCompleted) {
          offlineStore.removeCompletionLocally(dateStr, habitId);
          offlineStore.enqueue({ type: "uncomplete", habitId, date: dateStr });
        } else {
          offlineStore.addCompletionLocally(dateStr, habitId);
          offlineStore.enqueue({ type: "complete", habitId, date: dateStr });
        }
        setLocalCompletions(offlineStore.loadCompletions(dateStr));
        setLocalHabits(offlineStore.loadHabits());
      }
    },
    [effectivelyOnline, dateStr]
  );

  // ── Public createHabit (offline-aware) ──
  const createHabit = useCallback(
    (payload: CreateHabitRequest) => {
      if (effectivelyOnline) {
        createMut.mutate(
          { data: payload },
          {
            onError: () => {
              setApiReachable(false);
              const tempHabit: Habit = {
                id: -Date.now(),
                name: payload.name,
                icon: payload.icon ?? "💧",
                color: payload.color ?? "Indigo",
                frequency: payload.frequency ?? "daily",
                targetCount: payload.targetCount ?? 1,
                streak: 0,
                totalCompletions: 0,
                createdAt: new Date().toISOString(),
              };
              offlineStore.addHabitLocally(tempHabit);
              offlineStore.enqueue({ type: "create", payload });
              setLocalHabits(offlineStore.loadHabits());
              toast({ title: "Hábito salvo localmente", description: "Vai sincronizar quando a API estiver acessível." });
            },
          }
        );
      } else {
        const tempHabit: Habit = {
          id: -Date.now(),
          name: payload.name,
          icon: payload.icon ?? "💧",
          color: payload.color ?? "Indigo",
          frequency: payload.frequency ?? "daily",
          targetCount: payload.targetCount ?? 1,
          streak: 0,
          totalCompletions: 0,
          createdAt: new Date().toISOString(),
        };
        offlineStore.addHabitLocally(tempHabit);
        offlineStore.enqueue({ type: "create", payload });
        setLocalHabits(offlineStore.loadHabits());
        toast({ title: "Hábito salvo localmente", description: "Vai sincronizar quando voltar a internet." });
      }
    },
    [effectivelyOnline]
  );

  // ── Public deleteHabit (offline-aware) ──
  const deleteHabit = useCallback(
    ({ id }: { id: number }) => {
      if (effectivelyOnline) {
        deleteMut.mutate(
          { id },
          {
            onError: () => {
              setApiReachable(false);
              offlineStore.removeHabitLocally(id);
              offlineStore.enqueue({ type: "delete", habitId: id });
              setLocalHabits(offlineStore.loadHabits());
            },
          }
        );
      } else {
        offlineStore.removeHabitLocally(id);
        offlineStore.enqueue({ type: "delete", habitId: id });
        setLocalHabits(offlineStore.loadHabits());
        toast({ title: "Hábito removido localmente" });
      }
    },
    [effectivelyOnline]
  );

  // ── Public updateHabit (offline-aware) ──
  const updateHabit = useCallback(
    ({ id, data }: { id: number; data: UpdateHabitRequest }) => {
      if (effectivelyOnline) {
        updateMut.mutate(
          { id, data },
          {
            onError: () => {
              setApiReachable(false);
              offlineStore.updateHabitLocally(id, data as Partial<Habit>);
              offlineStore.enqueue({ type: "update", habitId: id, payload: data });
              setLocalHabits(offlineStore.loadHabits());
            },
          }
        );
      } else {
        offlineStore.updateHabitLocally(id, data as Partial<Habit>);
        offlineStore.enqueue({ type: "update", habitId: id, payload: data });
        setLocalHabits(offlineStore.loadHabits());
        toast({ title: "Hábito atualizado localmente" });
      }
    },
    [effectivelyOnline]
  );

  // ── Derived values ──
  const completedHabitIds = new Set(localCompletions.map(c => c.habitId));

  const isLoading = isOnline && apiReachable
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

export function useHabitStats() {
  return useGetStats();
}
