import { invalidateChange } from "@app/invalidate";
import { labelQueryKeys } from "@labels/keys";
import {
	createLabelFn,
	deleteLabelFn,
	findLabelsFn,
	updateLabelFn,
} from "@server/labels/functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Label } from "@virtool/contracts";

/**
 * Fetch a list of labels from the API
 *
 * @returns A list of labels
 */
export function useFetchLabels() {
	return useQuery<Label[]>({
		queryKey: labelQueryKeys.lists(),
		queryFn: () => findLabelsFn(),
	});
}

/**
 * Initialize a mutator for creating a label
 *
 * @returns A mutator for creating a label
 */
export function useCreateLabel() {
	const queryClient = useQueryClient();

	return useMutation<
		Label,
		Error,
		{ name: string; description: string; color: string }
	>({
		mutationFn: ({ name, description, color }) =>
			createLabelFn({ data: { color, description, name } }),
		onSuccess: (label) => {
			invalidateChange(queryClient, {
				domain: "labels",
				operation: "insert",
				id: label.id,
			});
		},
	});
}

/**
 * Initialize a mutator for updating a label
 *
 * @returns A mutator for updating a label
 */
export function useUpdateLabel() {
	const queryClient = useQueryClient();

	return useMutation<
		Label,
		Error,
		{ labelId: number; name: string; description: string; color: string }
	>({
		mutationFn: ({ labelId, name, description, color }) =>
			updateLabelFn({ data: { color, description, labelId, name } }),
		onSuccess: (label) => {
			invalidateChange(queryClient, {
				domain: "labels",
				operation: "update",
				id: label.id,
			});
		},
	});
}

/**
 * Initialize a mutator for deleting a label
 *
 * @returns A mutator for deleting a label
 */
export function useDeleteLabel() {
	const queryClient = useQueryClient();

	return useMutation<null, Error, { labelId: number }>({
		mutationFn: ({ labelId }) => deleteLabelFn({ data: { labelId } }),
		onSuccess: (_data, { labelId }) => {
			invalidateChange(queryClient, {
				domain: "labels",
				operation: "delete",
				id: labelId,
			});
		},
	});
}
