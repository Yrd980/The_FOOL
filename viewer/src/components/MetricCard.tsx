export function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#dbcfb4] bg-white/70 p-3 shadow-sm backdrop-blur-sm">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#5b6a71]">{label}</div>
      <div className="mt-1 font-mono text-2xl text-[#13232f]">{value}</div>
    </div>
  );
}
