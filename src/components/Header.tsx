"use client";
import { useAppStore } from "@/lib/store";

export default function Header() {
  const { selectedCity, setCity, searchText, setSearchText } = useAppStore();
  return (
    <header className="flex items-center gap-3 p-3 border-b">
      <h1 className="font-semibold">インフラ点検ビューア</h1>
      <select
        className="border rounded px-2 py-1"
        value={selectedCity}
        onChange={(e) => setCity(e.target.value as any)}
      >
        <option value="kochi">高知</option>
        <option value="osaka">大阪</option>
        <option value="tokyo">東京</option>
      </select>
      <input
        className="ml-auto border rounded px-3 py-1 w-64"
        placeholder="名称検索"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
      />
    </header>
  );
}
