import type { SideNavGroup } from "@base/Nav";
import { SideNav } from "@base/Nav";
import type { AdministratorRoleName } from "@virtool/contracts";
import { hasSufficientAdminRole } from "@virtool/contracts";
import {
	Database,
	FileUp,
	Mail,
	Megaphone,
	UserRound,
	UsersRound,
} from "lucide-react";

type AdministrationSidebarProps = {
	administratorRole: AdministratorRoleName | null;
};

/** Grouped navigation for administration pages. */
export default function AdministrationSidebar({
	administratorRole,
}: AdministrationSidebarProps) {
	const canManageSettings = hasSufficientAdminRole(
		"settings",
		administratorRole,
	);
	const canManageEmail = hasSufficientAdminRole("full", administratorRole);
	const groups: SideNavGroup[] = [];

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
				{ icon: FileUp, label: "Uploads", to: "/administration/uploads" },
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

	return <SideNav groups={groups} label="Administration" />;
}
