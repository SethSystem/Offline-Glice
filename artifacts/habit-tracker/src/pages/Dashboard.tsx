import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, X, Download } from "lucide-react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { HabitCard } from "@/components/HabitCard";
import { HabitFormDialog } from "@/components/HabitFormDialog";
import { useHabitsData } from "@/hooks/use-habits-data";
import { useReminders, requestNotificationPermission } from "@/hooks/use-reminders";
import { Habit } from "@workspace/api-client-react/src/generated/api.schemas";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Dashboard() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [currentDate] = useState(new Date());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBanner(false);
        setDeferredPrompt(null);
      }
    }
  };

  const {
    habits,
    isLoading,
    completedHabitIds,
    toggleCompletion,
    createHabit,
    updateHabit,
    deleteHabit,
    isCreating,
    isUpdating,
  } = useHabitsData(currentDate);

  useReminders(habits);

  const formattedDate = format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  const progress = habits.length > 0
    ? Math.round((completedHabitIds.size / habits.length) * 100)
    : 0;

  const handleOpenEdit = (habit: Habit) => { setEditingHabit(habit); setIsDialogOpen(true); };
  const handleOpenCreate = () => { setEditingHabit(null); setIsDialogOpen(true); };
  const handleSubmit = async (data: any) => {
    setIsDialogOpen(false);
    // If a reminder was set, ask for notification permission
    if (data.reminderTime) {
      await requestNotificationPermission();
    }
    if (editingHabit) {
      updateHabit({ id: editingHabit.id, data });
    } else {
      createHabit(data);
    }
  };

  return (
    <AppLayout>
      <div className="px-5 py-7 md:p-10 max-w-3xl w-full mx-auto">

        {/* PWA Install Banner */}
        {showInstallBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-5 flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3"
          >
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Download size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Instalar HabitFlow</p>
              <p className="text-xs text-muted-foreground">Use como app — funciona offline</p>
            </div>
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity shrink-0"
            >
              Instalar
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}

        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <p className="text-primary font-semibold text-xs tracking-widest uppercase mb-1">
              {capitalizedDate}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
              {getGreeting()}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {habits.length === 0
                ? "Comece criando seu primeiro hábito."
                : completedHabitIds.size === habits.length
                  ? "Todos os hábitos concluídos hoje."
                  : `${completedHabitIds.size} de ${habits.length} hábitos concluídos.`
              }
            </p>
          </div>

          {habits.length > 0 && (
            <div className="bg-card border border-border p-4 rounded-2xl shrink-0 w-full md:w-44">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-muted-foreground">Hoje</span>
                <span className="text-sm font-bold text-primary">{progress}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full"
                />
              </div>
            </div>
          )}
        </header>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-card rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <img
              src={`${import.meta.env.BASE_URL}images/empty-state.png`}
              alt="Nenhum hábito"
              className="w-52 h-52 object-contain mb-6 opacity-90 drop-shadow-xl"
            />
            <h2 className="text-xl font-bold mb-2">Nenhum hábito ainda</h2>
            <p className="text-muted-foreground mb-7 max-w-xs text-sm leading-relaxed">
              Pequenas mudanças diárias constroem grandes resultados. Crie seu primeiro hábito agora.
            </p>
            <button
              onClick={handleOpenCreate}
              className="bg-primary text-primary-foreground px-7 py-3.5 rounded-2xl font-semibold shadow-lg shadow-primary/25 hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Plus size={20} /> Criar Primeiro Hábito
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                isCompleted={completedHabitIds.has(habit.id)}
                onToggle={() => toggleCompletion(habit.id, completedHabitIds.has(habit.id))}
                onEdit={() => handleOpenEdit(habit)}
                onDelete={() => deleteHabit({ id: habit.id })}
              />
            ))}

            <button
              onClick={handleOpenCreate}
              className="w-full mt-4 py-4 rounded-2xl border-2 border-dashed border-border text-muted-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-secondary hover:text-foreground hover:border-primary/30 transition-all"
            >
              <Plus size={16} /> Adicionar hábito
            </button>
          </div>
        )}

        <HabitFormDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSubmit={handleSubmit}
          initialData={editingHabit}
          isLoading={isCreating || isUpdating}
        />
      </div>
    </AppLayout>
  );
}
