import type { SideNavGroup } from "@base/Nav";
import { SideNav } from "@base/Nav";
import { KeyRound, Settings, UserRound, UsersRound } from "lucide-react";

const groups: SideNavGroup[] = [
	{
		items: [
			{ icon: UserRound, label: "Profile", to: "/account/profile" },
			{ icon: UsersRound, label: "Groups", to: "/account/groups" },
			{ icon: Settings, label: "Settings", to: "/account/settings" },
			{ icon: KeyRound, label: "API Keys", to: "/account/api" },
		],
	},
];

/** Navigation for account pages. */
export default function AccountSidebar() {
	return <SideNav groups={groups} label="Account" />;
}
