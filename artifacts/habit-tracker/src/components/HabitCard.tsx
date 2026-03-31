import { motion } from "framer-motion";
import { Flame, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Habit } from "@workspace/api-client-react/src/generated/api.schemas";
import { cn, HABIT_COLORS } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface HabitCardProps {
  habit: Habit;
  isCompleted: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function HabitCard({ habit, isCompleted, onToggle, onEdit, onDelete }: HabitCardProps) {
  const colorObj = HABIT_COLORS.find(c => c.name === habit.color) || HABIT_COLORS[0];
  const colorClasses = colorObj.value.split(' ');
  const solidBgClass = colorClasses[0];
  const bgLightClass = colorClasses[2];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200",
        isCompleted
          ? "bg-card/60 border-border/50 opacity-70"
          : "bg-card border-border hover:border-border/80 hover:shadow-sm"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-all duration-200",
        bgLightClass,
        isCompleted && "grayscale opacity-60"
      )}>
        {habit.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-semibold text-base truncate transition-all duration-200",
          isCompleted ? "line-through text-muted-foreground" : "text-foreground"
        )}>
          {habit.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {habit.streak > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-500">
              <Flame size={11} fill="currentColor" />
              {habit.streak} dias
            </span>
          )}
          {habit.streak > 0 && habit.totalCompletions > 0 && (
            <span className="text-muted-foreground/40 text-xs">·</span>
          )}
          {habit.totalCompletions > 0 && (
            <span className="text-xs text-muted-foreground">
              {habit.totalCompletions} no total
            </span>
          )}
          {(habit as any).reminderTime && (
            <>
              {habit.totalCompletions > 0 && (
                <span className="text-muted-foreground/40 text-xs">·</span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {(habit as any).reminderTime}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
              <MoreVertical size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl min-w-[140px]">
            <DropdownMenuItem onClick={onEdit} className="rounded-lg gap-2 cursor-pointer text-sm">
              <Pencil size={14} /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="rounded-lg gap-2 cursor-pointer text-destructive focus:text-destructive text-sm">
              <Trash2 size={14} /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Check button — plain CSS, no AnimatePresence to avoid removeChild bug */}
        <button
          onClick={onToggle}
          aria-label={isCompleted ? "Desmarcar hábito" : "Marcar como concluído"}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 border-2 font-bold text-lg",
            isCompleted
              ? cn(solidBgClass, "border-transparent text-white scale-95")
              : "border-border hover:border-primary/50 hover:bg-primary/5 text-transparent"
          )}
        >
          ✓
        </button>
      </div>
    </motion.div>
  );
}
