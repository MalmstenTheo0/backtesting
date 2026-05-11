/**
 * Espaciado del picker (año / mes): cambiar solo aquí para ajustar márgenes entre celdas.
 * `pickGridGapClass` controla el gap de ambas rejillas; `pickCellPadClass` el padding interno de cada pill.
 */
export const pickGridGapClass = "gap-2";
export const pickCellPadClass = "px-0.5 py-2";

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export const monthFieldShellClass =
  "relative h-9 w-full min-w-0 rounded-control border border-border-strong bg-surface-2 transition-colors hover:border-accent/50 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-[var(--focus-ring)]";

/** Contenido del popover (posición: `fixed` vía portal en `document.body`). */
export const pickerPanelSurfaceClass =
  "min-w-[240px] w-max box-border rounded-control border border-border-strong bg-surface p-2 shadow-panel";

export const yearScrollClass = cx(
  "drp-panel-scrollbar max-h-48 w-full min-w-[240px] overflow-y-auto",
  "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border-strong",
);

export const pickYearGridClass = cx(
  "grid min-w-[240px] w-full grid-cols-[repeat(4,minmax(52px,1fr))]",
  pickGridGapClass,
);

export const pickMonthGridClass = cx(
  "grid w-full grid-cols-4 [grid-template-columns:repeat(4,minmax(0,1fr))]",
  pickGridGapClass,
);

const pickCellTypography =
  "text-center text-[13px] font-medium tabular-nums leading-normal transition-colors";

export const pickYearCellClass = cx(
  "box-border whitespace-nowrap rounded-control border",
  pickCellPadClass,
  pickCellTypography,
);

export const pickMonthCellClass = cx(
  "box-border min-w-0 max-w-full whitespace-nowrap rounded-control border",
  pickCellPadClass,
  pickCellTypography,
  "overflow-hidden text-ellipsis",
);

export const cellIdleClass =
  "border-border-strong bg-surface-2 text-text-secondary hover:border-accent/50";

export const cellActiveClass = "border-accent bg-accent-muted text-accent";

export const cellDisabledClass =
  "cursor-not-allowed border-border-strong bg-surface-2 text-text-muted opacity-50";

export const presetGridClass = "grid grid-cols-4 gap-1.5";

export const presetButtonBaseClass =
  "rounded-control border py-1.5 text-center text-[13px] font-medium leading-normal transition-colors";

export const triggerClass =
  "relative z-[1] flex h-9 w-full items-center px-2.5 text-left text-[13px] font-normal leading-normal text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2 disabled:cursor-not-allowed";

export const monthStepHeaderClass =
  "flex w-full min-w-0 items-center gap-1 border-b border-border pb-1.5";

export const monthStepBackButtonClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border-strong bg-surface-2 text-text-secondary transition-colors hover:border-accent/50";
