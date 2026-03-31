import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const habitsTable = pgTable("habits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("⭐"),
  color: text("color").notNull().default("#6366f1"),
  frequency: text("frequency").notNull().default("daily"),
  customDays: text("custom_days"),
  targetCount: integer("target_count").notNull().default(1),
  reminderTime: text("reminder_time"),
  streak: integer("streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  totalCompletions: integer("total_completions").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const habitCompletionsTable = pgTable("habit_completions", {
  id: serial("id").primaryKey(),
  habitId: integer("habit_id").notNull().references(() => habitsTable.id, { onDelete: "cascade" }),
  completedDate: text("completed_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHabitSchema = createInsertSchema(habitsTable).omit({ id: true, streak: true, longestStreak: true, totalCompletions: true, createdAt: true });
export const insertHabitCompletionSchema = createInsertSchema(habitCompletionsTable).omit({ id: true, createdAt: true });

export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type Habit = typeof habitsTable.$inferSelect;
export type HabitCompletion = typeof habitCompletionsTable.$inferSelect;
export type InsertHabitCompletion = z.infer<typeof insertHabitCompletionSchema>;
