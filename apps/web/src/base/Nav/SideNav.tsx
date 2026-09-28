import { cn } from "@app/cn";
import { useMatchPartialPath } from "@app/useMatchPartialPath";
import Link from "@base/Link";
import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";

/** A link in a side navigation group. */
type SideNavItem = { icon: LucideIcon; label: string; to: string };

/** A group of side navigation links, with an optional heading. */
export type SideNavGroup = { items: SideNavItem[]; label?: string };

type SideNavProps = {
	groups: SideNavGroup[];
	/** The name of the section the navigation belongs to. */
	label: string;
};

function SideNavLinks({
	groups,
	label,
	onNavigate,
}: SideNavProps & { onNavigate?: () => void }) {
	return (
		<nav aria-label={label} className="flex flex-col gap-6">
			{groups.map((group) => (
				<div key={group.label ?? group.items[0]?.to}>
					{group.label && (
						<h2 className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-gray-500">
							{group.label}
						</h2>
					)}
					<ul className="flex flex-col gap-1">
						{group.items.map((item) => (
							<SideNavLink key={item.to} item={item} onNavigate={onNavigate} />
						))}
					</ul>
				</div>
			))}
		</nav>
	);
}

function SideNavLink({
	item,
	onNavigate,
}: {
	item: SideNavItem;
	onNavigate?: () => void;
}) {
	const isActive = useMatchPartialPath(item.to);
	const ItemIcon = item.icon;

	return (
		<li>
			<Link
				aria-current={isActive ? "page" : undefined}
				className={cn(
					"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900",
					isActive && "bg-gray-100 text-gray-900",
				)}
				onClick={onNavigate}
				to={item.to}
			>
				<ItemIcon aria-hidden="true" className="size-4" />
				{item.label}
			</Link>
		</li>
	);
}

/** Grouped side navigation that collapses into a dialog on small screens. */
export default function SideNav({ groups, label }: SideNavProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<aside className="hidden w-56 shrink-0 lg:block">
				<SideNavLinks groups={groups} label={label} />
			</aside>
			<div className="mb-6 lg:hidden">
				<DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
					<DialogPrimitive.Trigger className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
						<Menu aria-hidden="true" className="size-4" />
						{label} menu
					</DialogPrimitive.Trigger>
					<DialogPrimitive.Portal>
						<DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-gray-500/60" />
						<DialogPrimitive.Content className="fixed inset-y-0 left-0 z-dialog w-72 overflow-y-auto bg-white p-6 shadow-2xl focus:outline-none">
							<DialogPrimitive.Title className="mb-6 text-lg font-medium">
								{label}
							</DialogPrimitive.Title>
							<SideNavLinks
								groups={groups}
								label={label}
								onNavigate={() => setIsOpen(false)}
							/>
						</DialogPrimitive.Content>
					</DialogPrimitive.Portal>
				</DialogPrimitive.Root>
			</div>
		</>
	);
}
