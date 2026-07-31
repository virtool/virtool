import type { AnalysisSearch } from "@analyses/search";
import { createContext, type ReactNode, useContext } from "react";

type AnalysisSearchContextValue = {
	search: AnalysisSearch;
	setSearch: (next: Partial<AnalysisSearch>) => void;
};

const AnalysisSearchContext = createContext<AnalysisSearchContextValue | null>(
	null,
);

type AnalysisSearchProviderProps = AnalysisSearchContextValue & {
	children: ReactNode;
};

export function AnalysisSearchProvider({
	children,
	search,
	setSearch,
}: AnalysisSearchProviderProps) {
	return (
		<AnalysisSearchContext value={{ search, setSearch }}>
			{children}
		</AnalysisSearchContext>
	);
}

export function useAnalysisSearch() {
	const value = useContext(AnalysisSearchContext);

	if (!value) {
		throw new Error("useAnalysisSearch must be used within an analysis route");
	}

	return value;
}
