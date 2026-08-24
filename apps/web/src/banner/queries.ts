import { bannerQueryKeys } from "@banner/keys";
import {
	clearActiveBannerFn,
	createBannerFn,
	deleteBannerFn,
	findBannerFn,
	findBannersFn,
	setActiveBannerFn,
	updateBannerFn,
} from "@server/banners/functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BannerColor } from "@virtool/contracts";
import type { Banner } from "./types";

/**
 * Fetch the active banner from the API.
 */
export function useFetchBanner() {
	return useQuery<Banner | null>({
		queryKey: bannerQueryKeys.active(),
		queryFn: () => findBannerFn(),
	});
}

/**
 * Fetch the full list of banners. Admin-only.
 */
export function useFetchBanners() {
	return useQuery<Banner[]>({
		queryKey: bannerQueryKeys.lists(),
		queryFn: () => findBannersFn(),
	});
}

/**
 * Initialize a mutator for creating a new banner.
 */
export function useCreateBanner() {
	const queryClient = useQueryClient();
	return useMutation<Banner, Error, { message: string; color: BannerColor }>({
		mutationFn: ({ message, color }) =>
			createBannerFn({ data: { message, color } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: bannerQueryKeys.all() });
		},
	});
}

/**
 * Initialize a mutator for updating an existing banner.
 */
export function useUpdateBanner() {
	const queryClient = useQueryClient();
	return useMutation<
		Banner,
		Error,
		{ id: number; message?: string; color?: BannerColor }
	>({
		mutationFn: async ({ id, message, color }) => {
			const banner = await updateBannerFn({ data: { id, message, color } });
			if (!banner) {
				throw new Error("Failed to update banner");
			}
			return banner;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: bannerQueryKeys.all() });
		},
	});
}

/**
 * Initialize a mutator for deleting a banner.
 */
export function useDeleteBanner() {
	const queryClient = useQueryClient();
	return useMutation<null, Error, { id: number }>({
		mutationFn: async ({ id }) => {
			await deleteBannerFn({ data: { id } });
			return null;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: bannerQueryKeys.all() });
		},
	});
}

/**
 * Initialize a mutator for activating a specific banner. Deactivates any
 * currently active banner in the same transaction.
 */
export function useSetActiveBanner() {
	const queryClient = useQueryClient();
	return useMutation<Banner, Error, { id: number }>({
		mutationFn: async ({ id }) => {
			const banner = await setActiveBannerFn({ data: { id } });
			if (!banner) {
				throw new Error("Failed to activate banner");
			}
			return banner;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: bannerQueryKeys.all() });
		},
	});
}

/**
 * Initialize a mutator for clearing the active banner.
 */
export function useClearActiveBanner() {
	const queryClient = useQueryClient();
	return useMutation<null, Error, void>({
		mutationFn: () => clearActiveBannerFn(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: bannerQueryKeys.all() });
		},
	});
}
