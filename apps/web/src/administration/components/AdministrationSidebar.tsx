import { cn } from "@app/cn";
import { useMatchPartialPath } from "@app/useMatchPartialPath";
import Link from "@base/Link";
import type { AdministratorRoleName } from "@virtool/contracts";
import { hasSufficientAdminRole } from "@virtool/contracts";
import type { LucideIcon } from "lucide-react";
import {
	Database,
	Mail,
	Megaphone,
	Menu,
	UserRound,
	UsersRound,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";

type AdministrationSidebarProps = {
	administratorRole: AdministratorRoleName | null;
};

type NavigationItem = { icon: LucideIcon; label: string; to: string };
type NavigationGroup = { items: NavigationItem[]; label: string };

function AdministrationNavigation({
	groups,
	onNavigate,
}: {
	groups: NavigationGroup[];
	onNavigate?: () => void;
}) {
	return (
		<nav aria-label="Administration" className="flex flex-col gap-6">
			{groups.map((group) => (
				<div key={group.label}>
					<h2 className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-gray-500">
						{group.label}
					</h2>
					<ul className="flex flex-col gap-1">
						{group.items.map((item) => (
							<AdministrationNavigationItem
								key={item.to}
								item={item}
								onNavigate={onNavigate}
							/>
						))}
					</ul>
				</div>
			))}
		</nav>
	);
}

function AdministrationNavigationItem({
	item,
	onNavigate,
}: {
	item: NavigationItem;
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

/** Grouped navigation for administration pages. */
export default function AdministrationSidebar({
	administratorRole,
}: AdministrationSidebarProps) {
	const [isOpen, setIsOpen] = useState(false);
	const canManageSettings = hasSufficientAdminRole(
		"settings",
		administratorRole,
	);
	const canManageEmail = hasSufficientAdminRole("full", administratorRole);
	const groups: NavigationGroup[] = [];

	if (canManageSettings) {
		groups.push({
			label: "General",
			items: [
				{ icon: Megaphone, label: "Banners", to: "/administration/banners" },
			],
		});
	}

	groups.push({
		label: "Access",
		items: [
			{ icon: UserRound, label: "Users", to: "/administration/users" },
			{ icon: UsersRound, label: "Groups", to: "/administration/groups" },
		],
	});

	if (canManageSettings) {
		groups.push({
			label: "Storage",
			items: [
				{ icon: Database, label: "Caching", to: "/administration/caching" },
			],
		});
	}

	if (canManageEmail) {
		groups.push({
			label: "Communication",
			items: [
				{ icon: Mail, label: "Email Delivery", to: "/administration/email" },
			],
		});
	}

	if (canManageSettings) {
		groups.push({
			label: "External Services",
			items: [{ icon: Database, label: "NCBI", to: "/administration/ncbi" }],
		});
	}

	return (
		<>
			<aside className="hidden w-56 shrink-0 lg:block">
				<AdministrationNavigation groups={groups} />
			</aside>
			<div className="mb-6 lg:hidden">
				<DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
					<DialogPrimitive.Trigger className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
						<Menu aria-hidden="true" className="size-4" />
						Administration menu
					</DialogPrimitive.Trigger>
					<DialogPrimitive.Portal>
						<DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-gray-500/60" />
						<DialogPrimitive.Content className="fixed inset-y-0 left-0 z-dialog w-72 overflow-y-auto bg-white p-6 shadow-2xl focus:outline-none">
							<DialogPrimitive.Title className="mb-6 text-lg font-medium">
								Administration
							</DialogPrimitive.Title>
							<AdministrationNavigation
								groups={groups}
								onNavigate={() => setIsOpen(false)}
							/>
						</DialogPrimitive.Content>
					</DialogPrimitive.Portal>
				</DialogPrimitive.Root>
			</div>
		</>
	);
}
