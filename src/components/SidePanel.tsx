"use client";

import { useAppStore } from "@/lib/store";

const TYPES = ["bridge", "road", "facility"];
const STATUS = ["pending", "inspecting", "done"];

export default function SidePanel() {
  const { filters, setFilters, selectedFeature } = useAppStore();
  return (
    <aside className="w-80 max-w-full border-l p-3 space-y-4">
      <section>
        <h2 className="font-semibold mb-2">フィルタ</h2>
        <div className="mb-3">
          <div className="text-sm mb-1">種別</div>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.types.includes(t)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...filters.types, t]
                      : filters.types.filter((x) => x !== t);
                    setFilters({ types: next });
                  }}
                />
                {t}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm mb-1">ステータス</div>
          <div className="flex flex-wrap gap-2">
            {STATUS.map((s) => (
              <label key={s} className="flex item-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.status.includes(s)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...filters.status, s]
                      : filters.status.filter((x) => x !== s);
                    setFilters({ status: next });
                  }}
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">詳細</h2>
        {selectedFeature ? (
          <div className="text-sm space-y-1">
            <div>
              <span className="font-mono">ID</span>: {selectedFeature.id}
            </div>
            <div>名称: {selectedFeature.properties?.name}</div>
            <div>種別: {selectedFeature.properties?.type}</div>
            <div>状態: {selectedFeature.properties?.status}</div>
            <div>更新日: {selectedFeature.properties?.last_updated}</div>
            <div>担当: {selectedFeature.properties?.owner}</div>
            <div>メモ: {selectedFeature.properties?.notes}</div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">
            地物をクリックすると詳細が表示されます
          </div>
        )}
      </section>

      <footer className="pt-4 border-t text-xs text-slate-500">
        © OpenStreetMap contributors / Cesium /
        PLATEAU（出典はREADMEに詳細記載）
      </footer>
    </aside>
  );
}
