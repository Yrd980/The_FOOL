// src/components/EntityDetailPanel.tsx
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
      className="entity-panel is-open"
      role="dialog"
      aria-label="Entity details"
    >
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
    </div>
  );
}

export default EntityDetailPanel;
