import { useState, useEffect } from "react";
import { Habit, CreateHabitRequest, HabitFrequency } from "@workspace/api-client-react/src/generated/api.schemas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HABIT_COLORS, COMMON_EMOJIS, cn } from "@/lib/utils";

interface HabitFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateHabitRequest) => void;
  initialData?: Habit | null;
  isLoading?: boolean;
}

export function HabitFormDialog({ isOpen, onClose, onSubmit, initialData, isLoading }: HabitFormDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("💧");
  const [color, setColor] = useState("Indigo");
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [targetCount, setTargetCount] = useState("1");
  const [reminderTime, setReminderTime] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setIcon(initialData.icon);
        setColor(initialData.color);
        setFrequency(initialData.frequency);
        setTargetCount(initialData.targetCount.toString());
        setReminderTime(initialData.reminderTime ?? "");
      } else {
        setName("");
        setIcon("💧");
        setColor("Indigo");
        setFrequency("daily");
        setTargetCount("1");
        setReminderTime("");
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name,
      icon,
      color,
      frequency,
      targetCount: parseInt(targetCount, 10) || 1,
      reminderTime: reminderTime || null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px] p-0 border border-border rounded-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">

          {/* Fixed header */}
          <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {initialData ? "Editar Hábito" : "Novo Hábito"}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome do Hábito</Label>
              <Input
                autoFocus
                placeholder="Ex: Beber água, Ler 10 páginas..."
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-12 rounded-xl text-base px-4 bg-secondary/50 border-transparent focus-visible:bg-background transition-colors"
                maxLength={40}
              />
            </div>

            {/* Icon picker */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ícone</Label>
              <div className="grid grid-cols-6 gap-2">
                {COMMON_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={cn(
                      "w-full aspect-square rounded-xl text-2xl flex items-center justify-center transition-all duration-150",
                      icon === emoji
                        ? "bg-primary/15 border-2 border-primary scale-105"
                        : "bg-secondary/60 hover:bg-secondary border-2 border-transparent"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cor</Label>
              <div className="flex gap-3 flex-wrap">
                {HABIT_COLORS.map(c => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setColor(c.name)}
                    className={cn(
                      "w-9 h-9 rounded-full transition-all duration-150 ring-offset-2 ring-offset-background",
                      c.value.split(' ')[0],
                      color === c.name ? "ring-2 ring-primary scale-110" : "hover:scale-105"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Frequency + target */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frequência</Label>
                <Select value={frequency} onValueChange={(v: HabitFrequency) => setFrequency(v)}>
                  <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-transparent text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="daily">Diariamente</SelectItem>
                    <SelectItem value="weekdays">Dias Úteis</SelectItem>
                    <SelectItem value="weekends">Fins de Semana</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vezes ao dia</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={targetCount}
                  onChange={e => setTargetCount(e.target.value)}
                  className="h-11 rounded-xl bg-secondary/50 border-transparent text-sm"
                />
              </div>
            </div>

            {/* Reminder */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lembrete
              </Label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                  </span>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={e => setReminderTime(e.target.value)}
                    className="w-full h-11 rounded-xl bg-secondary/50 border border-transparent pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                {reminderTime && (
                  <button
                    type="button"
                    onClick={() => setReminderTime("")}
                    className="h-11 px-3 rounded-xl text-xs text-muted-foreground bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    Remover
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground ml-1">
                {reminderTime
                  ? `Você será notificado todos os dias às ${reminderTime}`
                  : "Opcional — deixe vazio para sem lembrete"}
              </p>
            </div>

          </div>

          {/* Fixed footer button */}
          <div className="px-5 py-4 border-t border-border shrink-0">
            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="w-full h-12 rounded-xl text-base font-semibold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {isLoading ? "Salvando..." : (initialData ? "Salvar Alterações" : "Criar Hábito")}
            </button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
