import { cn } from "@app/cn";
import ExternalLink from "@base/ExternalLink";
import { iconButtonVariants } from "@base/Icon";
import Popover from "@base/Popover";
import Tooltip from "@base/Tooltip";
import { useChangelogPosts, useMarkChangelogSeen } from "@nav/changelog";
import { getNewestPostDate } from "@nav/posts";
import { SITE_ORIGIN } from "@virtool/contracts/blog";
import { Megaphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// A fixed locale and time zone keep the server and browser renders equal. Post
// dates are calendar days at UTC midnight.
const dateFormatter = new Intl.DateTimeFormat("en", {
	dateStyle: "medium",
	timeZone: "UTC",
});

/**
 * A nav-bar button that opens the website's posts about this version and the
 * releases before it.
 *
 * A dot shows while a post is unread. Opening the popover marks the posts it
 * shows as seen.
 */
export default function ChangelogPopover() {
	const { posts, unread } = useChangelogPosts();
	const mutation = useMarkChangelogSeen();

	const [open, setOpen] = useState(false);
	const markedTime = useRef<number | null>(null);

	const label = unread ? "What's new (unread)" : "What's new";
	const newestPostTime = getNewestPostDate(posts)?.getTime();
	const { mutate } = mutation;

	// Posts can load after the popover opens, so marking follows the open state
	// instead of the open event. Each date is sent once per opening, so a failed
	// request is not retried until the user opens the popover again.
	useEffect(() => {
		if (
			open &&
			unread &&
			newestPostTime !== undefined &&
			markedTime.current !== newestPostTime
		) {
			markedTime.current = newestPostTime;
			mutate(new Date(newestPostTime));
		}
	}, [mutate, newestPostTime, open, unread]);

	function onOpenChange(next: boolean) {
		setOpen(next);

		if (!next) {
			markedTime.current = null;
		}
	}

	return (
		<Popover
			alignOffset={0}
			onOpenChange={onOpenChange}
			sideOffset={4}
			trigger={
				<Tooltip capitalize={false} position="bottom" tip="What's new">
					<button
						aria-label={label}
						className={iconButtonVariants({ onDark: true })}
						type="button"
					>
						<span className="relative flex">
							<Megaphone size="1.2em" />
							{unread && (
								<span
									aria-hidden="true"
									className={cn(
										"absolute",
										"-right-0.5",
										"-top-0.5",
										"size-2",
										"rounded-full",
										"bg-orange-400",
									)}
								/>
							)}
						</span>
					</button>
				</Tooltip>
			}
		>
			<div className="flex flex-col">
				<h2 className="border-b border-gray-200 font-medium px-4 py-3">
					What's new
				</h2>
				{posts.length ? (
					<ul className="max-h-96 overflow-y-auto">
						{posts.map(({ date, image, slug, summary, title, version }) => (
							<li className="border-b border-gray-200 px-4 py-3" key={slug}>
								<img
									alt={image.alt}
									className="border border-gray-200 mb-2 rounded-md w-full"
									src={image.url}
								/>
								<ExternalLink
									className="font-medium text-blue-600 hover:underline"
									href={`${SITE_ORIGIN}/blog/${encodeURIComponent(slug)}`}
								>
									{title}
								</ExternalLink>
								<p className="pt-1 text-gray-700">{summary}</p>
								<p className="pt-1 text-gray-500 text-xs">
									{version} · {dateFormatter.format(date)}
								</p>
							</li>
						))}
					</ul>
				) : (
					<p className="border-b border-gray-200 px-4 py-3 text-gray-500">
						There are no posts for this version.
					</p>
				)}
				<ExternalLink
					className="px-4 py-3 text-blue-600 hover:underline"
					href={`${SITE_ORIGIN}/changelog`}
				>
					Full change history
				</ExternalLink>
			</div>
		</Popover>
	);
}
