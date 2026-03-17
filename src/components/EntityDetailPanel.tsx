// src/components/EntityDetailPanel.tsx
import { cn } from "../lib/cn";
import type { DetailCard } from "../types/entities";

type EntityDetailPanelProps = {
  card: DetailCard | null;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (actionId: string) => void;
};

function EntityDetailPanel({ card, isOpen, onClose, onAction }: EntityDetailPanelProps) {
  if (!isOpen || !card) return null;

  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 z-30 flex items-start justify-end p-[clamp(1rem,2.6vw,2rem)] max-[720px]:inset-x-0 max-[720px]:items-end max-[720px]:justify-stretch max-[720px]:p-3"
      role="dialog"
      aria-label="Entity details"
      aria-modal="false"
    >
      <div className="pointer-events-auto relative flex max-h-[calc(100vh-clamp(2rem,5.2vw,4rem))] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[26px_26px_12px_26px] border border-[rgba(18,12,13,0.92)] bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(245,234,225,0.95))] px-5 pb-5 pt-[4.5rem] shadow-[0_22px_44px_rgba(29,11,11,0.16),12px_12px_0_rgba(141,14,18,0.12)] backdrop-blur-[8px] max-[720px]:max-h-[min(78vh,680px)] max-[720px]:w-full max-[720px]:rounded-[24px_24px_12px_24px] max-[720px]:px-4 max-[720px]:pb-4 max-[720px]:pt-[4rem]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-[78px] w-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.54),transparent_36%),linear-gradient(135deg,rgba(200,29,24,0.22),rgba(200,29,24,0.04))]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-5 top-4 text-[4rem] leading-none text-[rgba(200,29,24,0.12)] [font-family:var(--font-display)]"
        >
          ×
        </div>

        <button
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-[rgba(18,12,13,0.9)] bg-[rgba(255,248,242,0.9)] text-[1.5rem] leading-none text-[#120c0d] shadow-[0_10px_22px_rgba(30,11,11,0.12)] transition duration-200 hover:-translate-y-[2px] hover:border-[#8d0e12] hover:text-[#8d0e12]"
          onClick={onClose}
          type="button"
          aria-label="Close"
        >
          ×
        </button>

        <div className="relative z-[1] flex-1 overflow-y-auto pr-1">
          <div className="inline-flex rounded-full border border-[rgba(18,12,13,0.88)] bg-[rgba(255,248,240,0.88)] px-[0.72rem] py-[0.36rem] text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#8d0e12]">
            {card.badge}
          </div>
          <div className="mt-4 text-[clamp(1.5rem,2vw,2rem)] uppercase tracking-[0.08em] text-[#120c0d] [font-family:var(--font-display)]">
            {card.title}
          </div>
          <div className="mt-1 text-[0.78rem] uppercase tracking-[0.18em] text-[rgba(18,12,13,0.52)]">
            {card.subtitle}
          </div>
          <div className="mt-4 rounded-[18px_18px_10px_18px] border border-[rgba(18,12,13,0.08)] bg-[rgba(255,255,255,0.56)] px-4 py-[0.9rem] text-[0.88rem] leading-[1.7] text-[rgba(18,12,13,0.78)] [font-family:var(--font-serif)] max-[720px]:px-[0.9rem] max-[720px]:text-[0.84rem]">
            {card.description}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
            {card.stats.map((stat) => (
              <div
                key={stat.label}
                className="grid gap-[0.35rem] rounded-[18px] border border-[rgba(18,12,13,0.08)] bg-[rgba(18,12,13,0.04)] px-[0.9rem] py-[0.82rem]"
              >
                <div className="text-[0.64rem] font-bold uppercase tracking-[0.18em] text-[rgba(18,12,13,0.45)]">
                  {stat.label}
                </div>
                <div className="text-[1.02rem] tracking-[0.04em] text-[#120c0d] [font-family:var(--font-display)]">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-[0.55rem]">
            {card.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-[rgba(18,12,13,0.88)] bg-[rgba(255,248,242,0.92)] px-[0.82rem] py-[0.5rem] text-[0.68rem] uppercase tracking-[0.12em] text-[#120c0d] shadow-[0_10px_20px_rgba(34,14,11,0.08)]"
              >
                {chip}
              </span>
            ))}
          </div>

          {card.actions && card.actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-[0.7rem]">
              {card.actions.map((action) => (
                <button
                  key={action.id}
                  className={cn(
                    "rounded-full border px-[1rem] py-[0.62rem] text-[0.72rem] uppercase tracking-[0.14em] shadow-[0_10px_20px_rgba(34,14,11,0.08)] transition duration-200",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    action.active
                      ? "border-[rgba(18,12,13,0.92)] bg-[linear-gradient(180deg,rgba(200,29,24,0.92),rgba(141,14,18,0.88))] text-[#fff6f2]"
                      : "border-[rgba(18,12,13,0.88)] bg-[rgba(255,248,242,0.92)] text-[#120c0d] hover:-translate-y-[2px] hover:border-[#8d0e12] hover:text-[#8d0e12]",
                  )}
                  onClick={() => onAction?.(action.id)}
                  disabled={action.disabled}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EntityDetailPanel;
