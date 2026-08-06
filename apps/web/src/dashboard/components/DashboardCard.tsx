import Box from "@base/Box";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import QueryError from "@base/QueryError";
import { CatchBoundary } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useContext, useId } from "react";

const HeadingIdContext = createContext("");

/**
 * The id of the enclosing card's heading, for a body that names itself by it.
 */
export function useDashboardCardHeadingId() {
	return useContext(HeadingIdContext);
}

type DashboardCardProps = {
	/** An optional link or button rendered opposite the title, e.g. "View all". */
	action?: ReactNode;

	/** The card body — a `BoxGroup` list, an empty state, or an error. */
	children: ReactNode;

	/** The card's heading. */
	title: string;
};

/**
 * A titled section of the dashboard.
 *
 * Owns the heading row so every card has the same shape whether its body holds
 * a table, an empty state, or a failed query. The body is supplied whole,
 * because only one of the three is a table.
 */
export default function DashboardCard({
	action,
	children,
	title,
}: DashboardCardProps) {
	const headingId = useId();

	return (
		<section aria-labelledby={headingId}>
			<header className="flex items-baseline justify-between mb-3">
				<h2 className="text-xl font-medium" id={headingId}>
					{title}
				</h2>
				{action}
			</header>
			<HeadingIdContext value={headingId}>{children}</HeadingIdContext>
		</section>
	);
}

type DashboardCardBoundaryProps = {
	/** The card body that reads the data. */
	children: ReactNode;

	/** What the card lists, for the error message — e.g. `"samples"`. */
	noun: string;
};

/**
 * Confines a card's failed read to that card.
 *
 * The cards read through suspense queries so that one loading state covers the
 * whole dashboard, and a suspense query reports a failure by throwing. Without
 * a boundary around each body, one failed request would reach the router and
 * replace the entire page with its error component.
 */
export function DashboardCardBoundary({
	children,
	noun,
}: DashboardCardBoundaryProps) {
	return (
		<CatchBoundary
			errorComponent={() => <QueryError noun={noun} />}
			getResetKey={() => noun}
		>
			{children}
		</CatchBoundary>
	);
}

type DashboardCardEmptyProps = {
	/** Optional secondary line explaining why the card is empty. */
	description?: ReactNode;

	/** The muted icon shown beside the title. */
	icon: LucideIcon;

	/** The primary line, announced by assistive technology. */
	title: ReactNode;
};

/**
 * The empty state for a dashboard card.
 *
 * The same stacked shape as `ListEmpty`, at a smaller icon and padding rather
 * than its fixed height: several of these can be on one screen at once, and a
 * full-height empty state per card would push everything below the fold.
 */
export function DashboardCardEmpty({
	description,
	icon: Icon,
	title,
}: DashboardCardEmptyProps) {
	return (
		<Box className="mb-0">
			<Empty className="py-8">
				<EmptyMedia className="text-gray-400">
					<Icon size={32} strokeWidth={1.5} />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				{description && <EmptyDescription>{description}</EmptyDescription>}
			</Empty>
		</Box>
	);
}
