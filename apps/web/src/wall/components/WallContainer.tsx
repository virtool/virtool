import type { OnlyChildrenProps } from "@/types/dom";

/**
 * A container for wall components that applies a max width to its children with
 * the brand background displayed on the excess space on the right.
 */
export function WallContainer({ children }: OnlyChildrenProps) {
	return (
		<div className="absolute bg-teal-600 flex items-center inset-0">
			<div className="bg-white flex flex-col h-full px-24">
				<div className="h-1/6" />
				<main className="w-96">{children}</main>
			</div>
		</div>
	);
}
