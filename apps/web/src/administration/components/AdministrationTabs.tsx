import { NavTab, NavTabs } from "@base/Nav";
import type { AdministratorRoleName } from "@virtool/contracts";
import { hasSufficientAdminRole } from "@virtool/contracts";
import type { ReactNode } from "react";

type AdministratorTabsProps = {
	administratorRole: AdministratorRoleName | null;
};

export default function AdministrationTabs({
	administratorRole,
}: AdministratorTabsProps) {
	const tabs: ReactNode[] = [];

	if (hasSufficientAdminRole("settings", administratorRole)) {
		tabs.push(<NavTab to="/administration/settings">Settings</NavTab>);
	}

	if (hasSufficientAdminRole("users", administratorRole)) {
		tabs.push(<NavTab to="/administration/users?status=active">Users</NavTab>);
		tabs.push(<NavTab to="/administration/groups">Groups</NavTab>);
	}

	return <NavTabs>{tabs}</NavTabs>;
}
