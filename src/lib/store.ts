import { create } from "zustand";

export type Filters = { types: string[]; status: string[] };

type State = {
  selectedCity: "kochi" | "osaka" | "tokyo";
  filters: Filters;
  searchText: string;
  selectedFeature: any | null;
  setCity: (c: State["selectedCity"]) => void;
  setFilters: (f: Partial<Filters>) => void;
  setSearchText: (t: string) => void;
  setSelectedFeature: (f: any | null) => void;
};

export const useAppStore = create<State>((set) => ({
  selectedCity: "kochi",
  filters: { types: [], status: [] },
  searchText: "",
  selectedFeature: null,
  setCity: (c) => set({ selectedCity: c }),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  setSearchText: (t) => set({ searchText: t }),
  setSelectedFeature: (f) => set({ selectedFeature: f }),
}));
