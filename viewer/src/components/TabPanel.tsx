import { useState, type ReactNode } from "react";
import { cn } from "../utils";

export type Tab = {
  id: string;
  label: string;
  icon?: string;
  content: ReactNode;
};

export function TabPanel({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div className="flex h-full flex-col">
      <nav className="mb-3 flex gap-1 rounded-2xl border border-[#dbcfb4] bg-white/60 p-1 backdrop-blur-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-sm font-medium transition",
              activeTab === tab.id
                ? "bg-[#13232f] text-[#f3f8fb] shadow-sm"
                : "text-[#5b6a71] hover:bg-white/80 hover:text-[#13232f]"
            )}
          >
            {tab.icon ? <span className="mr-1.5">{tab.icon}</span> : null}
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{active?.content}</div>
    </div>
  );
}
