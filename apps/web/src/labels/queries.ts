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
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: labelQueryKeys.lists() });
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
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: labelQueryKeys.lists() });
		},
	});
}

/**
 * Initialize a mutator for removing a label
 *
 * @returns A mutator for removing a label
 */
export function useRemoveLabel() {
	const queryClient = useQueryClient();

	return useMutation<null, Error, { labelId: number }>({
		mutationFn: ({ labelId }) => deleteLabelFn({ data: { labelId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: labelQueryKeys.lists() });
		},
	});
}
