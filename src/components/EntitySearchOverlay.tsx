// src/components/EntitySearchOverlay.tsx
import { useEffect, useRef, useState } from "react";
import type { ContestantSeat, SidebarEntity } from "../types/entities";

type SearchableEntity = {
  selectionId: string;
  name: string;
  color: string;
  searchable: string;
};

type EntitySearchOverlayProps = {
  isOpen: boolean;
  contestantSeats: ContestantSeat[];
  listenerEntities: SidebarEntity[];
  onSelect: (selectionId: string) => void;
  onClose: () => void;
};

function EntitySearchOverlay({
  isOpen,
  contestantSeats,
  listenerEntities,
  onSelect,
  onClose,
}: EntitySearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allEntities: SearchableEntity[] = [
    ...contestantSeats.map((s) => ({
      selectionId: s.selectionId,
      name: s.name,
      color: s.palette.primary,
      searchable: `${s.name} ${s.teamName} ${s.stateLabel}`,
    })),
    ...listenerEntities.map((e) => ({
      selectionId: e.selectionId,
      name: e.name,
      color: e.accent,
      searchable: e.searchable,
    })),
  ];

  const filtered = query.trim()
    ? allEntities.filter((e) => e.searchable.toLowerCase().includes(query.toLowerCase()))
    : allEntities;

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setFocusIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setFocusIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[focusIndex]) {
      onSelect(filtered[focusIndex].selectionId);
      onClose();
    }
  };

  return (
    <div className="entity-search" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="entity-search__box" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="entity-search__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entities..."
        />
        <div className="entity-search__results">
          {filtered.slice(0, 10).map((entity, index) => (
            <button
              key={entity.selectionId}
              className={`entity-search__item ${index === focusIndex ? "is-focused" : ""}`}
              onClick={() => {
                onSelect(entity.selectionId);
                onClose();
              }}
              type="button"
            >
              <span
                className="entity-search__item-dot"
                style={{ background: entity.color }}
              />
              {entity.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="entity-search__item" style={{ opacity: 0.5 }}>
              No matches
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EntitySearchOverlay;
