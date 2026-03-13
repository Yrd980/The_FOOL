// src/components/EntityDetailPanel.tsx
import { useEffect, useRef } from "react";
import type { DetailCard } from "../types/entities";

type EntityDetailPanelProps = {
  card: DetailCard | null;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (actionId: string) => void;
};

function EntityDetailPanel({ card, isOpen, onClose, onAction }: EntityDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap: capture focus when panel opens, restore on close
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus close button on open
    const closeBtn = panelRef.current?.querySelector<HTMLButtonElement>(".entity-panel__close");
    closeBtn?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap: cycle Tab within panel
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      // Restore focus on close
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <div
      ref={panelRef}
      className={`entity-panel ${isOpen && card ? "is-open" : ""}`}
      role="dialog"
      aria-label="Entity details"
    >
      {card && (
        <>
          <button className="entity-panel__close" onClick={onClose} type="button" aria-label="Close">
            ×
          </button>
          <div className="entity-panel__badge">{card.badge}</div>
          <div className="entity-panel__title">{card.title}</div>
          <div className="entity-panel__subtitle">{card.subtitle}</div>
          <div className="entity-panel__description">{card.description}</div>

          <div className="entity-panel__stats">
            {card.stats.map((stat) => (
              <div key={stat.label} className="entity-panel__stat">
                <div className="entity-panel__stat-label">{stat.label}</div>
                <div className="entity-panel__stat-value">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="entity-panel__chips">
            {card.chips.map((chip) => (
              <span key={chip} className="entity-panel__chip">{chip}</span>
            ))}
          </div>

          {card.actions && card.actions.length > 0 && (
            <div className="entity-panel__chips" style={{ marginTop: "12px" }}>
              {card.actions.map((action) => (
                <button
                  key={action.id}
                  className={`town-overlay__control-btn ${action.active ? "is-active" : ""}`}
                  onClick={() => onAction?.(action.id)}
                  disabled={action.disabled}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default EntityDetailPanel;
