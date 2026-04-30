import type { Theme } from "../../lib/themeStorage";

export interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
  /** Texto junto al control (p. ej. "Light" / "Dark"). */
  showLabel?: boolean;
  className?: string;
}

function SunGlyph({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonGlyph({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/**
 * Interruptor de tema (light / dark), estilo switch compacto.
 * Comportamiento controlado por el padre; solo UI y accesibilidad.
 */
export function ThemeToggle({
  theme,
  onToggle,
  showLabel = true,
  className = "",
}: ThemeToggleProps): JSX.Element {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={
        isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
      }
      onClick={onToggle}
      className={[
        "inline-flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-1.5 py-1",
        "text-text-muted transition-colors",
        "hover:bg-surface-2 hover:text-text-secondary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showLabel ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
          {isDark ? "Oscuro" : "Claro"}
        </span>
      ) : null}

      {/* Track: flex + padding centra el thumb sin mezclar translate X/Y */}
      <span
        className={[
          "relative flex h-6 w-11 shrink-0 items-center overflow-hidden rounded-full border p-[3px] shadow-inner transition-[border-color,background-color,box-shadow] duration-200 ease-out",
          isDark
            ? "border-[color-mix(in_srgb,var(--accent)_65%,var(--border-strong))] bg-accent shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]"
            : "border-border-strong bg-surface-2 shadow-[inset_0_1px_2px_rgba(13,17,23,0.06)]",
        ].join(" ")}
      >
        {/* Lado vacío = destino del clic: sol (→ claro) en oscuro, luna (→ oscuro) en claro */}
        <span
          className={[
            "pointer-events-none absolute left-[6px] top-1/2 z-0 -translate-y-1/2 transition-opacity duration-200",
            isDark
              ? "opacity-70 text-white/90"
              : "opacity-0",
          ].join(" ")}
          aria-hidden
        >
          <SunGlyph />
        </span>
        <span
          className={[
            "pointer-events-none absolute right-[6px] top-1/2 z-0 -translate-y-1/2 transition-opacity duration-200",
            isDark
              ? "opacity-0"
              : "opacity-70 text-text-secondary",
          ].join(" ")}
          aria-hidden
        >
          <MoonGlyph />
        </span>

        <span
          className={[
            "relative z-[1] h-[18px] w-[18px] shrink-0 rounded-full bg-white shadow-[0_1px_3px_rgba(13,17,23,0.2),0_0_0_1px_rgba(13,17,23,0.04)] transition-[margin] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isDark ? "ml-auto" : "ml-0",
          ].join(" ")}
        />
      </span>
    </button>
  );
}
