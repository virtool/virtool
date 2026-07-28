import type { UploadType } from "@virtool/contracts";
import { useEffect } from "react";
import { useInfiniteFindFiles } from "./queries";

/**
 * Hook for validating selected uploads from paginated data
 *
 * @param type - The file type
 * @param selected - The selected file id
 * @param setSelected - A callback function to handle file selection
 * @param onCleared - Called when a previously selected file can no longer be
 *   found and the selection is reset, so the caller can notify the user
 */
export function useValidateFiles(
	type: UploadType,
	selected: number[],
	setSelected: (selected: number[]) => void,
	onCleared?: () => void,
) {
	const { data, isPending, fetchNextPage, hasNextPage } = useInfiniteFindFiles(
		type,
		25,
	);

	useEffect(() => {
		if (!isPending && data && selected.length) {
			const items = data.pages.flatMap((page) => page.items);
			const selectedFilesExist = selected.every((itemId) =>
				items.some((item) => item.id === itemId),
			);

			if (!selectedFilesExist) {
				void fetchNextPage();
			}

			if (!hasNextPage && !selectedFilesExist) {
				setSelected([]);
				onCleared?.();
			}
		}
	}, [
		data,
		selected,
		hasNextPage,
		setSelected,
		isPending,
		fetchNextPage,
		onCleared,
	]);
}
