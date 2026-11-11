import { accountQueryOptions } from "@account/account";
import { accountQueryKeys } from "@account/keys";
import { markChangelogSeenFn } from "@server/changelog/functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import type { Account } from "@virtool/contracts";
import { fetchBlogIndex } from "./blogIndex";
import { changelogQueryKeys } from "./keys";
import { getShownPosts, hasUnreadPost } from "./posts";

/**
 * Fetch the website's released posts that this version contains, and whether
 * the user has a post to read.
 *
 * The browser fetches the index after hydration. A failed request or an index
 * that does not match the schema gives no posts.
 */
export function useChangelogPosts() {
	const hydrated = useHydrated();

	const { data: index } = useQuery({
		enabled: hydrated,
		queryFn: fetchBlogIndex,
		queryKey: changelogQueryKeys.all(),
		staleTime: 60 * 60 * 1000,
	});
	const { data: account } = useQuery(accountQueryOptions());

	const posts = index ? getShownPosts(index.posts, __APP_VERSION__) : [];

	return {
		posts,
		unread: account ? hasUnreadPost(posts, account.lastSeenChangelogAt) : false,
	};
}

/**
 * Initialize a mutator that moves the user's changelog watermark to the date of
 * the newest post that the popover showed.
 *
 * The cached account takes the new watermark before the request settles, so the
 * indicator clears as the popover opens.
 */
export function useMarkChangelogSeen() {
	const queryClient = useQueryClient();

	return useMutation<null, Error, Date, { previous: Account | undefined }>({
		mutationFn: (newestPostDate) =>
			markChangelogSeenFn({ data: { newestPostDate } }),
		onMutate: async (newestPostDate) => {
			await queryClient.cancelQueries({
				exact: true,
				queryKey: accountQueryKeys.all(),
			});

			const previous = queryClient.getQueryData<Account>(
				accountQueryKeys.all(),
			);

			if (previous && previous.lastSeenChangelogAt < newestPostDate) {
				queryClient.setQueryData<Account>(accountQueryKeys.all(), {
					...previous,
					lastSeenChangelogAt: newestPostDate,
				});
			}

			return { previous };
		},
		onError: (_error, _date, context) => {
			if (context?.previous) {
				queryClient.setQueryData(accountQueryKeys.all(), context.previous);
			}
		},
	});
}
