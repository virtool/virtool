import { useLocation } from "@tanstack/react-router";
import type { AdministratorRoleName } from "@virtool/contracts";
import { hasSufficientAdminRole } from "@virtool/contracts";
import { FlaskConical, FolderOpen, List, Settings, Tag } from "lucide-react";
import type { ReactNode } from "react";
import SidebarLink from "./SidebarLink";

type SidebarProps = {
	administratorRole: AdministratorRoleName | null;
};

/**
 * Displays the sidebar with routes to manage the component
 */
export default function Sidebar({ administratorRole }: SidebarProps) {
	const fullAdministrator = hasSufficientAdminRole("full", administratorRole);
	const { pathname } = useLocation();

	let links: ReactNode = null;

	if (pathname.startsWith("/jobs")) {
		links = (
			<SidebarLink
				exclude={["/jobs/settings"]}
				title="Browse"
				link="/jobs"
				icon={List}
			/>
		);
	} else if (pathname.startsWith("/samples")) {
		links = (
			<>
				<SidebarLink
					exclude={[
						"/samples/files",
						"/samples/uploads",
						"/samples/labels",
						"/samples/settings",
					]}
					title="Browse"
					link="/samples"
					icon={List}
				/>
				<SidebarLink title="Files" link="/samples/files" icon={FolderOpen} />
				<SidebarLink title="Labels" link="/samples/labels" icon={Tag} />
				{fullAdministrator ? (
					<SidebarLink
						title="Settings"
						link="/samples/settings"
						icon={Settings}
					/>
				) : null}
			</>
		);
	} else if (pathname.startsWith("/refs")) {
		links = (
			<>
				<SidebarLink
					exclude={["/refs/beta", "/refs/settings"]}
					title="Browse"
					link="/refs"
					icon={List}
				/>
				<SidebarLink title="Beta" link="/refs/beta" icon={FlaskConical} />
				{fullAdministrator ? (
					<SidebarLink title="Settings" link="/refs/settings" icon={Settings} />
				) : null}
			</>
		);
	} else if (pathname.startsWith("/subtractions")) {
		links = (
			<>
				<SidebarLink
					exclude={["/subtractions/uploads"]}
					title="Browse"
					link="/subtractions"
					icon={List}
				/>
				<SidebarLink
					title="Files"
					link="/subtractions/files?page=1"
					icon={FolderOpen}
				/>
			</>
		);
	} else if (pathname.startsWith("/hmms")) {
		links = (
			<SidebarLink
				exclude={["/hmms/settings"]}
				title="Browse"
				link="/hmms"
				icon={List}
			/>
		);
	}

	if (!links) {
		return <div className="w-28" />;
	}

	return (
		<nav aria-label="Section" className="flex w-28 flex-col items-center">
			{links}
		</nav>
	);
}
