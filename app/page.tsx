"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dashboardsSeed from "@/dashboards.json";

type Dashboard = {
  id: string;
  title: string;
  url: string;
  intervalSeconds: number;
  sandbox?: string;
  allow?: string;
};

const STORAGE_KEY = "dashboard-rotation-overrides-v1";
const SETTINGS_KEY = "dashboard-rotation-settings-v1";
const DEFAULT_INTERVAL = 60;

type TvSettings = {
  tvHeightVH: number;
  iframeReloadSeconds: number;
};

function loadStoredDashboards(): Dashboard[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((d) => typeof d?.url === "string" && d.url.length > 0);
  } catch (err) {
    console.warn("Failed to read stored dashboards", err);
    return null;
  }
}

function persistDashboards(list: Dashboard[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadSettings(): TvSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.tvHeightVH === "number") {
      return {
        tvHeightVH: parsed.tvHeightVH,
        iframeReloadSeconds:
          typeof parsed?.iframeReloadSeconds === "number" ? parsed.iframeReloadSeconds : 0,
      };
    }
    return null;
  } catch (err) {
    console.warn("Failed to read settings", err);
    return null;
  }
}

function persistSettings(settings: TvSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
}

export default function Home() {
  const [dashboards, setDashboards] = useState<Dashboard[]>(dashboardsSeed);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [tvMode, setTvMode] = useState(false);
  const [tvHeightVH, setTvHeightVH] = useState<number>(100);
  const [iframeReloadSeconds, setIframeReloadSeconds] = useState<number>(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [importText, setImportText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load overrides from localStorage on mount
  useEffect(() => {
    const stored = loadStoredDashboards();
    if (stored && stored.length > 0) {
      setDashboards(stored);
      setCurrentIndex(0);
    }

    const storedSettings = loadSettings();
    if (storedSettings?.tvHeightVH) setTvHeightVH(storedSettings.tvHeightVH);
    if (typeof storedSettings?.iframeReloadSeconds === "number") {
      setIframeReloadSeconds(storedSettings.iframeReloadSeconds);
    }
  }, []);

  // Keep current index in bounds after edits
  useEffect(() => {
    if (currentIndex >= dashboards.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, dashboards.length]);

  // Rotation timer
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!autoRotate || dashboards.length === 0) return;

    const current = dashboards[currentIndex];
    const intervalMs = (current?.intervalSeconds || DEFAULT_INTERVAL) * 1000;

    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % dashboards.length);
    }, intervalMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoRotate, dashboards, currentIndex]);

  useEffect(() => {
    if (reloadTimerRef.current) {
      clearInterval(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }

    if (iframeReloadSeconds <= 0 || dashboards.length === 0) return;

    reloadTimerRef.current = setInterval(() => {
      setReloadNonce((prev) => prev + 1);
    }, iframeReloadSeconds * 1000);

    return () => {
      if (reloadTimerRef.current) clearInterval(reloadTimerRef.current);
    };
  }, [iframeReloadSeconds, dashboards.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % dashboards.length);
  }, [dashboards.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + dashboards.length) % dashboards.length);
  }, [dashboards.length]);

  const updateDashboard = useCallback(
    (id: string, patch: Partial<Dashboard>) => {
      setDashboards((prev) => {
        const updated = prev.map((d) => (d.id === id ? { ...d, ...patch } : d));
        persistDashboards(updated);
        return updated;
      });
    },
    [],
  );

  const removeDashboard = useCallback((id: string) => {
    setDashboards((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      persistDashboards(updated);
      return updated;
    });
  }, []);

  const addDashboard = useCallback(() => {
    const fresh: Dashboard = {
      id: randomId(),
      title: "Novo dashboard",
      url: "https://",
      intervalSeconds: DEFAULT_INTERVAL,
    };
    setDashboards((prev) => {
      const updated = [...prev, fresh];
      persistDashboards(updated);
      return updated;
    });
    setCurrentIndex((prev) => prev === 0 && dashboards.length === 0 ? 0 : prev);
  }, [dashboards.length]);

  const handleImport = useCallback(() => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) throw new Error("JSON precisa ser uma lista");
      const sanitized: Dashboard[] = parsed
        .filter((d) => d?.url)
        .map((d) => ({
          id: d.id || randomId(),
          title: d.title || "Dashboard",
          url: d.url,
          intervalSeconds: Number(d.intervalSeconds) || DEFAULT_INTERVAL,
          sandbox: d.sandbox,
          allow: d.allow,
        }));
      setDashboards(sanitized);
      setCurrentIndex(0);
      persistDashboards(sanitized);
      setImportText("");
    } catch (err) {
      alert("Importação falhou: " + (err as Error).message);
    }
  }, [importText]);

  const handleExport = useCallback(async () => {
    const text = JSON.stringify(dashboards, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      alert("Config copiada para a área de transferência.");
    } catch {
      alert("Não foi possível copiar. Cole manualmente:\n" + text);
    }
  }, [dashboards]);

  const current = dashboards[currentIndex];
  const rotationInfo = useMemo(
    () =>
      dashboards.map((d, idx) => ({
        label: `${idx + 1}/${dashboards.length}: ${d.title}`,
        active: idx === currentIndex,
      })),
    [dashboards, currentIndex],
  );

  useEffect(() => {
    persistSettings({ tvHeightVH, iframeReloadSeconds });
  }, [tvHeightVH, iframeReloadSeconds]);

  const containerClass = tvMode
    ? "min-h-screen w-screen flex flex-col gap-4 px-4 py-4 bg-neutral-950 text-neutral-50"
    : "min-h-screen bg-neutral-950 text-neutral-50 mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 lg:flex-row lg:gap-6";

  const frameClass = tvMode
    ? "relative w-full flex-1 min-h-[60vh] overflow-hidden rounded-2xl border border-white/10 bg-black"
    : "relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black";

  const frameStyle = tvMode ? { height: `${tvHeightVH}vh` } : undefined;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className={containerClass}>
        <section className="w-full flex-1 space-y-4">
          <header className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 shadow-md shadow-black/40">
            <div className="flex-1 min-w-[240px]">
              <p className="text-sm uppercase tracking-wide text-white/70">Rotação ativa</p>
              <p className="text-lg font-semibold leading-tight">{current?.title || "Sem dashboards"}</p>
              <p className="text-sm text-white/60">
                Intervalo desta tela: {current?.intervalSeconds || DEFAULT_INTERVAL}s
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setAutoRotate((v) => !v)}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold transition hover:border-white/30 hover:bg-white/15"
              >
                {autoRotate ? "Pausar" : "Retomar"}
              </button>
              <button
                onClick={handlePrev}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm transition hover:border-white/30 hover:bg-white/10"
              >
                ← Anterior
              </button>
              <button
                onClick={handleNext}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm transition hover:border-white/30 hover:bg-white/10"
              >
                Próximo →
              </button>
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-wide text-white/70">
                Altura (vh)
                <input
                  type="number"
                  min={60}
                  max={100}
                  value={tvHeightVH}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 100;
                    const clamped = Math.min(100, Math.max(60, next));
                    setTvHeightVH(clamped);
                  }}
                  className="w-16 rounded border border-white/15 bg-black/40 px-2 py-1 text-white focus:border-white/40 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-wide text-white/70">
                Reload iframes (s)
                <input
                  type="number"
                  min={0}
                  value={iframeReloadSeconds}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setIframeReloadSeconds(Number.isFinite(next) ? Math.max(0, next) : 0);
                  }}
                  className="w-16 rounded border border-white/15 bg-black/40 px-2 py-1 text-white focus:border-white/40 focus:outline-none"
                />
              </label>
              <button
                onClick={() => {
                  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
                  else document.exitFullscreen?.();
                }}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm transition hover:border-white/30 hover:bg-white/15"
              >
                Alternar tela cheia
              </button>
              <button
                onClick={() => setTvMode((v) => !v)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${tvMode ? "border-amber-200/50 bg-amber-500/20 text-amber-50 hover:border-amber-200/80" : "border-white/15 bg-white/5 text-white hover:border-white/30"}`}
              >
                {tvMode ? "Sair do modo TV" : "Modo TV (ocupar tela)"}
              </button>
            </div>
          </header>

          <div className={frameClass} style={frameStyle}>
            {dashboards.map((dashboard, idx) => (
              <iframe
                key={`${dashboard.id}-${reloadNonce}`}
                src={dashboard.url}
                sandbox={dashboard.sandbox}
                allow={dashboard.allow}
                className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${idx === currentIndex ? "opacity-100" : "pointer-events-none opacity-0"}`}
                allowFullScreen
              />
            ))}
            {dashboards.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-white/60">
                Nenhum dashboard cadastrado.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-white/60">
            {rotationInfo.map((item) => (
              <span
                key={item.label}
                className={`rounded-full border px-2 py-1 ${item.active ? "border-white/70 bg-white/10 text-white" : "border-white/10"}`}
              >
                {item.label}
              </span>
            ))}
          </div>
        </section>

        {!tvMode && (
          <aside className="w-full max-w-xl space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 shadow-md shadow-black/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-white/60">Configuração</p>
              <h2 className="text-lg font-semibold">Dashboards e intervalos</h2>
            </div>
            <button
              onClick={addDashboard}
              className="rounded-lg border border-emerald-200/40 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-500/30"
            >
              + Adicionar
            </button>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {dashboards.map((dash) => (
              <div key={dash.id} className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-start gap-2">
                  <input
                    value={dash.title}
                    onChange={(e) => updateDashboard(dash.id, { title: e.target.value })}
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-white/40 focus:outline-none"
                    placeholder="Título"
                  />
                  <button
                    onClick={() => removeDashboard(dash.id)}
                    className="rounded-md border border-red-200/40 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:border-red-200/70 hover:bg-red-500/30"
                  >
                    Remover
                  </button>
                </div>
                <input
                  value={dash.url}
                  onChange={(e) => updateDashboard(dash.id, { url: e.target.value })}
                  className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-white/40 focus:outline-none"
                  placeholder="URL do iframe"
                />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <label className="flex items-center gap-2 text-white/70">
                    <span className="whitespace-nowrap text-xs uppercase tracking-wide">Intervalo (s)</span>
                    <input
                      type="number"
                      min={5}
                      value={dash.intervalSeconds}
                      onChange={(e) => updateDashboard(dash.id, { intervalSeconds: Number(e.target.value) })}
                      className="w-24 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm focus:border-white/40 focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-white/70">
                    <span className="whitespace-nowrap text-xs uppercase tracking-wide">Sandbox (opcional)</span>
                    <input
                      value={dash.sandbox || ""}
                      onChange={(e) => updateDashboard(dash.id, { sandbox: e.target.value || undefined })}
                      className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm focus:border-white/40 focus:outline-none"
                    />
                  </label>
                  <label className="col-span-2 flex items-center gap-2 text-white/70">
                    <span className="whitespace-nowrap text-xs uppercase tracking-wide">Allow (opcional)</span>
                    <input
                      value={dash.allow || ""}
                      onChange={(e) => updateDashboard(dash.id, { allow: e.target.value || undefined })}
                      className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm focus:border-white/40 focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            ))}
            {dashboards.length === 0 && (
              <p className="text-sm text-white/60">Adicione ao menos um dashboard para começar.</p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-semibold">Importar / Exportar JSON</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Cole aqui o JSON de dashboards para importar"
              className="h-28 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
            />
            <div className="flex gap-2 text-sm">
              <button
                onClick={handleImport}
                className="flex-1 rounded-md border border-white/15 bg-white/10 px-3 py-2 font-semibold transition hover:border-white/30 hover:bg-white/15"
              >
                Importar
              </button>
              <button
                onClick={handleExport}
                className="flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 font-semibold transition hover:border-white/30 hover:bg-white/10"
              >
                Exportar
              </button>
            </div>
            <p className="text-xs text-white/60">
              As edições ficam só neste navegador (localStorage). Faça export/import para usar em outra TV.
            </p>
          </div>
          </aside>
        )}
      </div>
    </div>
  );
}
