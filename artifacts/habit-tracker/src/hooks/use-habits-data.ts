export function useHabitsData(date: Date = new Date()) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const dateStr = format(date, "yyyy-MM-dd");

  const [localHabits, setLocalHabits] = useState<Habit[]>(() =>
    offlineStore.loadHabits()
  );

  const [localCompletions, setLocalCompletions] = useState<HabitCompletion[]>(() =>
    offlineStore.loadCompletions(dateStr)
  );

  const habitsQuery = useListHabits({ query: { enabled: isOnline } });
  const completionsQuery = useListCompletions(
    { from: dateStr, to: dateStr },
    { query: { enabled: isOnline } }
  );

  // sync server → local
  useEffect(() => {
    if (habitsQuery.data) {
      offlineStore.saveHabits(habitsQuery.data);
      setLocalHabits(habitsQuery.data);
    }
  }, [habitsQuery.data]);

  useEffect(() => {
    if (completionsQuery.data) {
      offlineStore.saveCompletions(dateStr, completionsQuery.data);
      setLocalCompletions(completionsQuery.data);
    }
  }, [completionsQuery.data, dateStr]);

  // 🔥 CREATE FIX PRINCIPAL
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

    // 🔥 SEMPRE atualiza UI primeiro (isso resolve seu bug)
    offlineStore.addHabitLocally(tempHabit);
    setLocalHabits(offlineStore.loadHabits());

    if (isOnline) {
      // tenta salvar no servidor, mas NÃO bloqueia UI
      createMut.mutate({ data: payload });
    } else {
      offlineStore.enqueue({ type: "create", payload });
      toast({
        title: "Hábito salvo localmente",
        description: "Será sincronizado quando voltar online.",
      });
    }
  }, [isOnline]);

  // DELETE FIX
  const deleteHabit = useCallback(({ id }: { id: number }) => {
    offlineStore.removeHabitLocally(id);
    setLocalHabits(offlineStore.loadHabits());

    if (isOnline) {
      deleteMut.mutate({ id });
    } else {
      offlineStore.enqueue({ type: "delete", habitId: id });
    }
  }, [isOnline]);

  // UPDATE FIX
  const updateHabit = useCallback(({ id, data }: any) => {
    offlineStore.updateHabitLocally(id, data);
    setLocalHabits(offlineStore.loadHabits());

    if (isOnline) {
      updateMut.mutate({ id, data });
    } else {
      offlineStore.enqueue({ type: "update", habitId: id, payload: data });
    }
  }, [isOnline]);

  // TOGGLE FIX
  const toggleCompletion = useCallback((habitId: number, isCompleted: boolean) => {
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
  }, [isOnline, dateStr]);

  const completedHabitIds = new Set(localCompletions.map(c => c.habitId));

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
