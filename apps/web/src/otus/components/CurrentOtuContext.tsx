import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import { useFetchOtu } from "@otus/queries";
import { useFetchReference } from "@references/queries";
import type { Otu, Reference } from "@virtool/contracts";
import { createContext, type ReactNode, useContext } from "react";

type CurrentOtuContextValue = {
	otu: Otu;
	reference: Reference;
};

const CurrentOtuContext = createContext<CurrentOtuContextValue | null>(null);

/**
 * Initializes a hook to access the current OTU context within a component
 *
 * @returns The current OTU context
 */
export function useCurrentOtuContext() {
	const context = useContext(CurrentOtuContext);

	if (!context) {
		throw new Error(
			"useCurrentOtuContext must be used within a CurrentOtuContextProvider",
		);
	}

	return context;
}

type CurrentOtuContextProviderProps = {
	children: ReactNode;
	otuId: string;
	refId: string;
};

/**
 * Provides the current OTU context to children components
 *
 * @returns Element wrapping children components with the current OTU context
 */
export function CurrentOtuContextProvider({
	children,
	otuId,
	refId,
}: CurrentOtuContextProviderProps) {
	const {
		data: otu,
		isPending: isPendingOtu,
		isError: isErrorOtu,
	} = useFetchOtu(otuId);
	const {
		data: reference,
		isPending: isPendingReference,
		isError: isErrorReference,
	} = useFetchReference(Number(refId));

	if ((isErrorOtu || isErrorReference) && (!otu || !reference)) {
		return <QueryError noun="OTU" />;
	}

	if (isPendingOtu || isPendingReference) {
		return <LoadingPlaceholder />;
	}

	return (
		<CurrentOtuContext.Provider value={{ otu, reference }}>
			{children}
		</CurrentOtuContext.Provider>
	);
}
