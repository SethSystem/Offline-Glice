import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { requestNotificationPermission, getNotificationPermission } from "@/hooks/use-reminders";

export default function SettingsPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(() => getNotificationPermission());

  const handleRequestNotif = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? "granted" : "denied");
    if (granted) {
      // Send a test notification immediately
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("🔔 HabitFlow", {
        body: "Lembretes ativados! Você vai receber alertas nos horários configurados.",
        icon: "/favicon.svg",
        tag: "test-notification",
      });
    }
  };

  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setTheme('dark');
    }
    const savedTheme = localStorage.getItem('habitflow-theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setTheme('dark');
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const toggleTheme = () => {
    if (theme === 'light') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('habitflow-theme', 'dark');
      setTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('habitflow-theme', 'light');
      setTheme('light');
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setDeferredPrompt(null);
      }
    }
  };

  return (
    <AppLayout>
      <div className="px-6 py-8 md:p-10 max-w-2xl mx-auto w-full">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Ajustes</h1>
          <p className="text-muted-foreground mt-1">Personalize sua experiência.</p>
        </header>

        <div className="space-y-4">

          {/* Aparência */}
          <section className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-secondary/30">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Aparência</p>
            </div>
            <SettingRow
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {theme === 'dark'
                    ? <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    : <><circle cx="12" cy="12" r="5" /><path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></>
                  }
                </svg>
              }
              title="Modo Escuro"
              description="Alternar entre tema claro e escuro"
              action={
                <button
                  onClick={toggleTheme}
                  className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${theme === 'dark' ? 'bg-primary' : 'bg-secondary'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              }
            />
          </section>

          {/* Instalar */}
          <section className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-secondary/30">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Instalação</p>
            </div>
            <SettingRow
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <path d="M12 18h.01" strokeWidth="3" strokeLinecap="round" />
                </svg>
              }
              title="Instalar no Dispositivo"
              description={installed ? "App instalado com sucesso!" : deferredPrompt ? "Adicionar à tela inicial como app nativo" : "Abra no Chrome para instalar"}
              action={
                <button
                  onClick={handleInstall}
                  disabled={!deferredPrompt || installed}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    installed
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : deferredPrompt
                      ? 'bg-primary text-primary-foreground border-transparent hover:opacity-90'
                      : 'bg-secondary text-muted-foreground border-border cursor-default'
                  }`}
                >
                  {installed ? '✓ Instalado' : 'Instalar'}
                </button>
              }
            />
          </section>

          {/* Notificações */}
          <section className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-secondary/30">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Lembretes</p>
            </div>
            <SettingRow
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              }
              title="Notificações"
              description={
                notifPermission === "granted"
                  ? "Ativadas — você vai receber alertas nos horários configurados"
                  : notifPermission === "denied"
                  ? "Bloqueadas — ative nas configurações do celular"
                  : "Permita notificações para receber lembretes"
              }
              action={
                notifPermission === "granted" ? (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-lg">✓ Ativas</span>
                ) : notifPermission === "denied" ? (
                  <span className="text-xs font-semibold text-red-500 bg-red-500/10 px-3 py-1.5 rounded-lg">Bloqueadas</span>
                ) : (
                  <button
                    onClick={handleRequestNotif}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    Ativar
                  </button>
                )
              }
            />
            {notifPermission === "granted" && (
              <div className="px-4 py-3 border-t border-border/50 bg-secondary/10">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Importante:</span> os lembretes funcionam enquanto o app estiver aberto ou em segundo plano. Configure os horários ao criar ou editar cada hábito.
                </p>
              </div>
            )}
            {notifPermission === "denied" && (
              <div className="px-4 py-3 border-t border-border/50 bg-red-500/5">
                <p className="text-xs text-muted-foreground">
                  Vá em <span className="font-medium">Configurações do celular → Apps → Chrome (ou HabitFlow) → Notificações</span> e ative as permissões.
                </p>
              </div>
            )}
          </section>

          {/* Sobre */}
          <section className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-secondary/30">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sobre</p>
            </div>

            <SettingRow
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              }
              title="HabitFlow"
              description="Versão 1.0 · PWA Offline-first"
            />
            <SettingRow
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="M6 12h.01M18 12h.01" />
                </svg>
              }
              title="Desenvolvido por"
              description="SETHSYSTEM · Tecnologia própria"
            />
            <SettingRow
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              }
              title="Privacidade"
              description="Seus dados ficam apenas no seu dispositivo"
            />
          </section>

        </div>
      </div>
    </AppLayout>
  );
}

function SettingRow({ icon, title, description, action }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-secondary/20 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-foreground shrink-0">
          {icon}
        </div>
        <div>
          <p className="font-medium text-sm text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
