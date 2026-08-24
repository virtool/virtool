import Box from "@base/Box";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyMedia,
	EmptyTitle,
} from "./Empty";

type ListEmptyProps = {
	/** Recovery actions rendered below the text, e.g. a create or rebuild button. */
	children?: ReactNode;

	/** Optional secondary line explaining why the list is empty. */
	description?: ReactNode;

	/** The muted icon shown above the title. */
	icon: LucideIcon;

	/** The primary line, announced by assistive technology. */
	title: ReactNode;
};

/**
 * The standard empty state for a paginated list: a boxed, fixed-height `Empty`
 * with a large muted icon, a title, and optional description and actions.
 *
 * Composes the `Empty*` primitives so a change to how every list looks when it
 * is empty is a single edit here rather than one per list view.
 */
export default function ListEmpty({
	children,
	description,
	icon: Icon,
	title,
}: ListEmptyProps) {
	return (
		<Box>
			<Empty className="h-72">
				<EmptyMedia className="text-gray-400">
					<Icon size={40} strokeWidth={1.5} />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				{description && <EmptyDescription>{description}</EmptyDescription>}
				{children && <EmptyContent>{children}</EmptyContent>}
			</Empty>
		</Box>
	);
}
