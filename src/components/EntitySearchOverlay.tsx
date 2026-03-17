// src/components/EntitySearchOverlay.tsx
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../lib/cn";
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

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
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
    <div
      className="absolute inset-0 z-40 flex items-start justify-center bg-[rgba(18,12,13,0.42)] px-4 pb-6 pt-[clamp(6rem,12vh,8rem)] backdrop-blur-[10px] max-[720px]:px-3 max-[720px]:pt-[5.4rem]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Search entities"
      aria-modal="true"
    >
      <div
        className="relative w-[min(760px,100%)] overflow-hidden rounded-[28px_28px_12px_28px] border border-[rgba(18,12,13,0.92)] bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(245,236,227,0.96))] shadow-[0_26px_60px_rgba(20,10,11,0.22),14px_14px_0_rgba(141,14,18,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[92px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.6),transparent_34%),linear-gradient(135deg,rgba(200,29,24,0.22),rgba(200,29,24,0.04))]"
        />
        <div className="relative flex items-start justify-between gap-4 border-b border-[rgba(18,12,13,0.08)] px-5 pb-4 pt-5 max-[720px]:px-4">
          <div>
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#8d0e12]">
              Command Index
            </div>
            <div className="mt-2 text-[clamp(1.45rem,2vw,2rem)] uppercase tracking-[0.08em] text-[#120c0d] [font-family:var(--font-display)]">
              搜索龙虾 / 评委 / 围观人类
            </div>
            <div className="mt-2 text-[0.78rem] uppercase tracking-[0.14em] text-[rgba(18,12,13,0.48)]">
              Name / Team / State / Role
            </div>
          </div>
          <button
            className="relative z-[1] grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(18,12,13,0.88)] bg-[rgba(255,248,242,0.9)] text-[1.5rem] leading-none text-[#120c0d] shadow-[0_10px_20px_rgba(30,11,11,0.12)] transition duration-200 hover:-translate-y-[2px] hover:border-[#8d0e12] hover:text-[#8d0e12]"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <input
          ref={inputRef}
          className="mx-5 mt-5 block w-[calc(100%-2.5rem)] rounded-[18px] border border-[rgba(18,12,13,0.18)] bg-[rgba(255,255,255,0.8)] px-4 py-[0.95rem] text-[0.95rem] text-[#120c0d] outline-none transition duration-200 placeholder:text-[rgba(18,12,13,0.34)] focus:border-[#8d0e12] focus:bg-white focus:shadow-[0_0_0_4px_rgba(200,29,24,0.08)] max-[720px]:mx-4 max-[720px]:mt-4 max-[720px]:w-[calc(100%-2rem)]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入名字、队伍、状态或角色..."
        />
        <div className="grid max-h-[min(58vh,560px)] gap-2 overflow-y-auto px-5 pb-5 pt-4 max-[720px]:max-h-[54vh] max-[720px]:px-4">
          {filtered.slice(0, 10).map((entity, index) => (
            <button
              key={entity.selectionId}
              className={cn(
                "flex items-center gap-3 rounded-[20px_20px_10px_20px] border px-4 py-[0.95rem] text-left transition duration-200",
                "hover:-translate-y-[2px] hover:border-[#8d0e12] hover:bg-[rgba(255,250,246,0.96)]",
                index === focusIndex
                  ? "border-[rgba(141,14,18,0.72)] bg-[rgba(255,247,241,0.96)] shadow-[0_16px_30px_rgba(35,12,10,0.12)]"
                  : "border-[rgba(18,12,13,0.08)] bg-[rgba(255,255,255,0.62)]",
              )}
              onClick={() => {
                onSelect(entity.selectionId);
                onClose();
              }}
              type="button"
            >
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-[rgba(18,12,13,0.88)] shadow-[0_0_0_6px_rgba(255,255,255,0.45)]"
                style={{ background: entity.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[0.92rem] uppercase tracking-[0.08em] text-[#120c0d] [font-family:var(--font-display)]">
                {entity.name}
              </span>
              <span className="text-[0.62rem] uppercase tracking-[0.18em] text-[rgba(18,12,13,0.42)]">
                {index === focusIndex ? "enter" : "select"}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-[20px_20px_10px_20px] border border-dashed border-[rgba(18,12,13,0.18)] bg-[rgba(255,255,255,0.48)] px-4 py-6 text-center text-[0.8rem] uppercase tracking-[0.14em] text-[rgba(18,12,13,0.46)]">
              No matches
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EntitySearchOverlay;
