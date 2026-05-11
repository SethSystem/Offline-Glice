import { format, subDays } from "date-fns";
import type {
  Habit,
  HabitCompletion,
  CreateHabitRequest,
  UpdateHabitRequest,
  StatsResponse,
} from "./types";

const K = {
  habits: "hf:habits",
  comp: (date: string) => `hf:comp:${date}`,
  nextId: "hf:nextId",
};

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function genId(): number {
  const id = read<number>(K.nextId, 1);
  write(K.nextId, id + 1);
  return id;
}

function safeDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
}

function calcStreak(habitId: number, fromDate: string): number {
  let streak = 0;
  let cur = fromDate;
  for (let i = 0; i < 366; i++) {
    const comps = read<HabitCompletion[]>(K.comp(cur), []);
    if (comps.some((c) => c.habitId === habitId)) {
      streak++;
      cur = format(subDays(safeDate(cur), 1), "yyyy-MM-dd");
    } else {
      break;
    }
  }
  return streak;
}

export const store = {
  // ── Habits ───────────────────────────────────────────────────────────────
  loadHabits(): Habit[] {
    return read<Habit[]>(K.habits, []);
  },

  saveHabits(habits: Habit[]) {
    write(K.habits, habits);
  },

  createHabit(data: CreateHabitRequest): Habit {
    const habit: Habit = {
      id: genId(),
      name: data.name,
      icon: data.icon ?? "💧",
      color: data.color ?? "Indigo",
      frequency: data.frequency ?? "daily",
      targetCount: data.targetCount ?? 1,
      streak: 0,
      longestStreak: 0,
      totalCompletions: 0,
      createdAt: new Date().toISOString(),
      reminderTime: data.reminderTime ?? null,
      description: data.description ?? null,
    };
    const habits = this.loadHabits();
    this.saveHabits([...habits, habit]);
    return habit;
  },

  updateHabit(id: number, data: UpdateHabitRequest): Habit | null {
    const habits = this.loadHabits();
    const idx = habits.findIndex((h) => h.id === id);
    if (idx === -1) return null;
    habits[idx] = { ...habits[idx], ...data } as Habit;
    this.saveHabits(habits);
    return habits[idx];
  },

  deleteHabit(id: number) {
    this.saveHabits(this.loadHabits().filter((h) => h.id !== id));
  },

  // ── Completions ───────────────────────────────────────────────────────────
  loadCompletions(date: string): HabitCompletion[] {
    return read<HabitCompletion[]>(K.comp(date), []);
  },

  addCompletion(date: string, habitId: number): boolean {
    const comps = this.loadCompletions(date);
    if (comps.some((c) => c.habitId === habitId)) return false;

    const completion: HabitCompletion = {
      id: genId(),
      habitId,
      completedDate: date,
      createdAt: new Date().toISOString(),
    };
    write(K.comp(date), [...comps, completion]);

    const habits = this.loadHabits();
    const habit = habits.find((h) => h.id === habitId);
    if (habit) {
      const streak = calcStreak(habitId, date);
      habit.streak = streak;
      habit.longestStreak = Math.max(habit.longestStreak, streak);
      habit.totalCompletions++;
      this.saveHabits(habits);
    }
    return true;
  },

  removeCompletion(date: string, habitId: number): boolean {
    const comps = this.loadCompletions(date);
    const filtered = comps.filter((c) => c.habitId !== habitId);
    if (filtered.length === comps.length) return false;

    write(K.comp(date), filtered);

    const habits = this.loadHabits();
    const habit = habits.find((h) => h.id === habitId);
    if (habit) {
      const yesterday = format(subDays(safeDate(date), 1), "yyyy-MM-dd");
      habit.streak = calcStreak(habitId, yesterday);
      habit.totalCompletions = Math.max(0, habit.totalCompletions - 1);
      this.saveHabits(habits);
    }
    return true;
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  buildStats(today: string): StatsResponse {
    const habits = this.loadHabits();
    const last30 = Array.from({ length: 30 }, (_, i) =>
      format(subDays(safeDate(today), 29 - i), "yyyy-MM-dd")
    );

    const byDate: Record<string, number[]> = {};
    for (const d of last30) {
      byDate[d] = this.loadCompletions(d).map((c) => c.habitId);
    }

    const todayIds = byDate[today] ?? [];

    const habitStats = habits.map((habit) => {
      const weeklyData = last30.map((d) => ({
        date: d,
        completed: (byDate[d] ?? []).includes(habit.id),
      }));
      const done = weeklyData.filter((d) => d.completed).length;
      return {
        habitId: habit.id,
        name: habit.name,
        icon: habit.icon,
        color: habit.color,
        streak: habit.streak,
        longestStreak: habit.longestStreak,
        totalCompletions: habit.totalCompletions,
        completionRate: done / 30,
        weeklyData,
      };
    });

    const longestStreakEver = habits.reduce(
      (max, h) => Math.max(max, h.streak),
      0
    );

    const insights: string[] = [];
    if (habits.length === 0) {
      insights.push(
        "Crie seu primeiro hábito para começar a acompanhar seu progresso."
      );
    } else {
      const sorted = [...habitStats].sort(
        (a, b) => b.completionRate - a.completionRate
      );
      const best = sorted[0];
      if (best && best.completionRate > 0) {
        insights.push(
          `Seu hábito mais consistente é "${best.name}" com ${Math.round(
            best.completionRate * 100
          )}% de conclusão nos últimos 30 dias.`
        );
      }
      if (longestStreakEver >= 7) {
        insights.push(
          `Incrível! Você manteve uma sequência de ${longestStreakEver} dias. Continue assim!`
        );
      } else if (longestStreakEver >= 3) {
        insights.push(
          `Boa sequência de ${longestStreakEver} dias! Tente chegar a 7.`
        );
      }
      if (todayIds.length === habits.length && habits.length > 0) {
        insights.push("Parabéns! Você concluiu todos os hábitos de hoje. 🎉");
      } else if (todayIds.length === 0 && habits.length > 0) {
        insights.push(
          "Você ainda não marcou nenhum hábito hoje. Vamos lá!"
        );
      }
    }

    return {
      totalHabits: habits.length,
      completedToday: todayIds.length,
      longestStreakEver,
      insights,
      habitStats,
    };
  },
};
