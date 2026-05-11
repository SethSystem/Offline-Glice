export type HabitFrequency = "daily" | "weekdays" | "weekends";

export interface Habit {
  id: number;
  name: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  targetCount: number;
  streak: number;
  longestStreak: number;
  totalCompletions: number;
  createdAt: string;
  reminderTime?: string | null;
  description?: string | null;
}

export interface HabitCompletion {
  id: number;
  habitId: number;
  completedDate: string;
  createdAt: string;
}

export interface CreateHabitRequest {
  name: string;
  icon?: string | null;
  color?: string | null;
  frequency?: HabitFrequency | null;
  targetCount?: number | null;
  reminderTime?: string | null;
  description?: string | null;
}

export type UpdateHabitRequest = Partial<CreateHabitRequest>;

export interface HabitStatWeeklyDataItem {
  date: string;
  completed: boolean;
}

export interface HabitStat {
  habitId: number;
  name: string;
  icon: string;
  color: string;
  streak: number;
  longestStreak: number;
  totalCompletions: number;
  completionRate: number;
  weeklyData: HabitStatWeeklyDataItem[];
}

export interface StatsResponse {
  totalHabits: number;
  completedToday: number;
  longestStreakEver: number;
  insights: string[];
  habitStats: HabitStat[];
}
