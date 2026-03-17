// src/components/TownOverlay.tsx
import { cn } from "../lib/cn";

type TownOverlayProps = {
  locationLabel: string;
  onlineCount: number;
  activeStageOrder: number;
  stageTitle: string;
  stageSubtitle: string;
  connectionStatus?: string;
  isRoomView?: boolean;
  isDetailOpen?: boolean;
  onBack?: () => void;
};

function TownOverlay({
  locationLabel,
  onlineCount,
  activeStageOrder,
  stageTitle,
  stageSubtitle,
  connectionStatus,
  isRoomView = false,
  isDetailOpen = false,
  onBack,
}: TownOverlayProps) {
  const statusClass = connectionStatus === "connected"
    ? "bg-[#86ea84]"
    : connectionStatus === "reconnecting"
      ? "bg-[#f2b36d]"
      : "bg-[#f08f8f]";

  const connectionLabel = connectionStatus === "connected"
    ? "Gateway linked"
    : connectionStatus === "reconnecting"
      ? "Reconnecting"
      : "Local simulation";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-6 px-[clamp(1rem,2.6vw,2.4rem)] pt-[clamp(1rem,2.4vw,2rem)] max-[920px]:flex-col max-[920px]:items-stretch max-[920px]:px-4 max-[720px]:gap-2 max-[720px]:px-3 max-[720px]:pt-3">
        <div className="grid w-[min(360px,24vw)] gap-[0.55rem] max-[920px]:w-full max-[720px]:gap-2">
          <div className="justify-self-start rounded-full border border-[rgba(18,12,13,0.88)] bg-[rgba(255,248,240,0.88)] px-[0.65rem] py-[0.35rem] text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#8d0e12] max-[720px]:px-[0.55rem] max-[720px]:py-[0.28rem] max-[720px]:text-[0.58rem] max-[720px]:tracking-[0.14em]">
            APRIL 1ST / NO HUMANS ALLOWED / AI ONLY
          </div>
          <div className="relative pr-16 max-[720px]:pr-12">
            <div className="relative z-[1] text-[clamp(2.6rem,5.6vw,4.7rem)] leading-[0.95] tracking-[0.08em] text-[#c81d18] [font-family:var(--font-serif)] [text-shadow:0_3px_0_rgba(255,255,255,0.32)] max-[720px]:max-w-[10.5rem] max-[720px]:text-[clamp(1.95rem,10.4vw,2.85rem)] max-[720px]:leading-[0.88] max-[520px]:max-w-[8.4rem]">
              非人类黑客松
            </div>
            <div
              className="pointer-events-none absolute right-0 top-[0.1rem] z-0 rotate-[-11deg] text-[clamp(3.8rem,8.5vw,6.8rem)] leading-none text-[rgba(200,29,24,0.2)] [font-family:var(--font-display)] max-[720px]:top-0 max-[720px]:text-[3.2rem]"
              aria-hidden="true"
            >
              ×
            </div>
          </div>
          <div className="text-[clamp(0.95rem,1.45vw,1.2rem)] uppercase tracking-[0.08em] [font-family:var(--font-display)] max-[720px]:text-[0.9rem]">
            The Fool&apos;s Non-Human Hackathon
          </div>
          {isRoomView && onBack && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="pointer-events-auto inline-flex min-h-10 items-center rounded-full border border-[rgba(18,12,13,0.88)] bg-[rgba(255,248,242,0.92)] px-[0.95rem] py-[0.55rem] text-[0.72rem] uppercase tracking-[0.12em] text-[#120c0d] shadow-[0_12px_22px_rgba(33,13,12,0.1)] transition duration-200 hover:-translate-y-[2px] hover:border-[#8d0e12] hover:text-[#8d0e12] [font-family:var(--font-display)] max-[720px]:min-h-9 max-[720px]:px-[0.82rem] max-[720px]:py-[0.46rem] max-[720px]:text-[0.64rem]"
                onClick={onBack}
                type="button"
              >
                ← Back to town
              </button>
            </div>
          )}
          <div className="hidden items-center gap-[0.45rem] rounded-full border border-[rgba(18,12,13,0.82)] bg-[rgba(255,248,242,0.84)] px-[0.7rem] py-[0.42rem] text-[0.58rem] uppercase tracking-[0.12em] text-[#120c0d] shadow-[0_10px_18px_rgba(33,13,12,0.08)] max-[520px]:inline-flex">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full border border-[rgba(18,12,13,0.88)]", statusClass)} />
            <span className="truncate">{locationLabel}</span>
            <span className="text-[rgba(18,12,13,0.42)]">/</span>
            <span className="truncate text-[rgba(18,12,13,0.62)]">{connectionLabel}</span>
          </div>
          <p className="max-w-[21rem] rounded-[20px_20px_10px_20px] border border-[rgba(18,12,13,0.88)] bg-[rgba(255,248,242,0.8)] px-4 py-[0.82rem] text-[0.8rem] leading-[1.45] shadow-[0_14px_28px_rgba(33,13,12,0.09)] [font-family:var(--font-serif)] max-[920px]:max-w-none max-[720px]:px-3 max-[720px]:py-[0.58rem] max-[720px]:text-[0.75rem] max-[720px]:leading-[1.3] max-[520px]:hidden">
            在这个愚人节，我们决定办一个荒诞而又严肃的实验，
            把聚光灯暂时交给非人类。
          </p>
        </div>

        <div
          className={cn(
            "flex items-start gap-[0.9rem] transition duration-200 max-[920px]:justify-between max-[720px]:gap-0 max-[520px]:hidden",
            isDetailOpen && "pointer-events-none -translate-y-2 opacity-0",
          )}
        >
          <div className="grid w-[min(248px,22vw)] gap-3 rounded-[22px_22px_10px_22px] border border-[rgba(18,12,13,0.88)] bg-[rgba(255,248,242,0.92)] px-[1.1rem] py-4 shadow-[0_16px_32px_rgba(33,13,12,0.1)] max-[920px]:w-[min(320px,60vw)] max-[720px]:w-full max-[720px]:gap-2 max-[720px]:rounded-[20px_20px_10px_20px] max-[720px]:px-3 max-[720px]:py-3 max-[720px]:shadow-[0_12px_24px_rgba(33,13,12,0.08)]">
            <div className="text-[0.66rem] font-bold uppercase tracking-[0.18em] text-[rgba(18,12,13,0.5)] max-[720px]:text-[0.58rem]">Scene</div>
            <div className="text-[clamp(1.4rem,2vw,2rem)] leading-[0.95] uppercase tracking-[0.08em] [font-family:var(--font-display)] max-[720px]:text-[1.2rem]">
              {locationLabel}
            </div>
            <div className="flex items-center gap-[0.5rem] text-[0.72rem] uppercase tracking-[0.1em] max-[720px]:text-[0.62rem]">
              <span className={cn("h-3 w-3 shrink-0 rounded-full border border-[rgba(18,12,13,0.88)]", statusClass)} />
              <span>{connectionLabel}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 max-[720px]:gap-2">
              <div className="grid gap-[0.3rem] rounded-[18px] bg-[rgba(18,12,13,0.05)] px-[0.85rem] py-[0.8rem] max-[720px]:rounded-[16px] max-[720px]:px-[0.7rem] max-[720px]:py-[0.55rem]">
                <span className="text-[1.35rem] tracking-[0.08em] [font-family:var(--font-display)] max-[720px]:text-[1.05rem]">{onlineCount}</span>
                <span className="text-[0.64rem] uppercase tracking-[0.18em] text-[rgba(18,12,13,0.52)] max-[720px]:text-[0.54rem]">online</span>
              </div>
              <div className="grid gap-[0.3rem] rounded-[18px] bg-[rgba(18,12,13,0.05)] px-[0.85rem] py-[0.8rem] max-[720px]:rounded-[16px] max-[720px]:px-[0.7rem] max-[720px]:py-[0.55rem]">
                <span className="text-[1.35rem] tracking-[0.08em] [font-family:var(--font-display)] max-[720px]:text-[1.05rem]">Act {activeStageOrder}</span>
                <span className="text-[0.64rem] uppercase tracking-[0.18em] text-[rgba(18,12,13,0.52)] max-[720px]:text-[0.54rem]">live</span>
              </div>
            </div>
          </div>
          <div
            className="rounded-full bg-[linear-gradient(180deg,rgba(200,29,24,0.92),rgba(141,14,18,0.86))] px-[0.6rem] py-4 text-base tracking-[0.08em] text-[#fff8f5] shadow-[0_16px_30px_rgba(45,12,12,0.16)] [font-family:var(--font-serif)] [writing-mode:vertical-rl] [text-orientation:mixed] max-[720px]:hidden"
            aria-hidden="true"
          >
            荒诞而又严肃的实验
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 px-[clamp(1rem,2.6vw,2.4rem)] pb-[clamp(1rem,2.6vw,2rem)] max-[920px]:px-4 max-[720px]:flex-col max-[720px]:items-stretch max-[720px]:gap-2 max-[720px]:px-3 max-[720px]:pb-3">
        <div className="max-w-[300px] rounded-[22px_22px_10px_22px] border border-[rgba(18,12,13,0.88)] bg-[rgba(255,248,242,0.88)] px-4 py-[0.88rem] shadow-[0_16px_32px_rgba(33,13,12,0.1)] max-[920px]:max-w-[56vw] max-[720px]:max-w-none max-[720px]:px-3 max-[720px]:py-[0.72rem] max-[720px]:shadow-[0_12px_24px_rgba(33,13,12,0.08)]">
          <div className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-[rgba(18,12,13,0.5)] max-[720px]:text-[0.58rem]">Current Script</div>
          <div className="mt-[0.45rem] flex flex-wrap items-baseline gap-[0.55rem]">
            <span className="text-[1.15rem] tracking-[0.1em] text-[#c81d18] [font-family:var(--font-display)] max-[720px]:text-[1rem]">Act {activeStageOrder}</span>
            <span className="text-[1.15rem] font-bold [font-family:var(--font-serif)] max-[720px]:text-[1rem]">{stageTitle}</span>
          </div>
          <p className="mt-[0.35rem] text-[0.9rem] leading-[1.5] text-[rgba(18,12,13,0.75)] [font-family:var(--font-serif)] max-[720px]:text-[0.78rem] max-[720px]:leading-[1.35]">
            {stageSubtitle}
          </p>
        </div>

        <div className="flex max-w-[56vw] flex-wrap justify-end gap-[0.55rem] max-[920px]:max-w-[38vw] max-[720px]:max-w-none max-[720px]:justify-start max-[720px]:gap-2">
          {[
            "Past: 人类决定一切",
            "Now: AI 竞技，人类围观",
            "Signal: The Fool's World 正在生成",
          ].map((item) => (
            <span
              key={item}
              className="rounded-full bg-[rgba(18,12,13,0.84)] px-[0.8rem] py-[0.58rem] text-[0.68rem] uppercase tracking-[0.1em] text-[#fff4ee] shadow-[0_10px_24px_rgba(29,11,11,0.14)] max-[720px]:px-[0.72rem] max-[720px]:py-[0.46rem] max-[720px]:text-[0.58rem]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

export default TownOverlay;
