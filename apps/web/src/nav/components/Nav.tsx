import { useLogout } from "@account/queries";
import Dropdown from "@base/Dropdown";
import DropdownMenuContent from "@base/DropdownMenuContent";
import DropdownMenuItem from "@base/DropdownMenuItem";
import DropdownMenuLink from "@base/DropdownMenuLink";
import DropdownMenuSeparator from "@base/DropdownMenuSeparator";
import DropdownMenuTrigger from "@base/DropdownMenuTrigger";
import IconButton from "@base/IconButton";
import InitialIcon from "@base/InitialIcon";
import Logo from "@base/Logo";
import type { AdministratorRoleName } from "@virtool/contracts";
import { hasSufficientAdminRole } from "@virtool/contracts";
import { Info } from "lucide-react";
import { useState } from "react";
import AboutDialog from "./AboutDialog";
import { NavLink } from "./NavLink";

type NavBarProps = {
	administrator_role: AdministratorRoleName | null;
	handle: string;
};

/**
 * Display the main navigation bar with links too root level views.
 */
export default function Nav({ administrator_role, handle }: NavBarProps) {
	const mutation = useLogout();
	const [aboutOpen, setAboutOpen] = useState(false);

	function onLogout() {
		mutation.mutate();
	}

	return (
		<nav
			aria-label="Primary"
			className="bg-virtool flex h-13 items-center justify-between text-white"
		>
			<div className="flex gap-3 items-center pl-7">
				<NavLink ariaLabel="Dashboard" to="/">
					{/* No `color`, so the logo follows the link's own text colour and
					    inverts with it when `/` is the active route. */}
					<Logo className="m-0" height={28} />
				</NavLink>
				<NavLink to="/jobs" search={{ state: "running" }}>
					Jobs
				</NavLink>
				<NavLink to="/samples">Samples</NavLink>
				<NavLink to="/refs">References</NavLink>
				<NavLink to="/hmms">HMMs</NavLink>
				<NavLink to="/subtractions">Subtractions</NavLink>
			</div>

			<div className="flex gap-2 items-center pr-4">
				<IconButton
					onClick={() => setAboutOpen(true)}
					IconComponent={Info}
					tip="About"
					onDark
				/>

				<Dropdown>
					<DropdownMenuTrigger aria-label="User menu">
						<div className="bg-transparent flex items-center">
							<InitialIcon handle={handle} size="md" />
						</div>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLink to="/account">
							Signed in as <strong>{handle}</strong>
						</DropdownMenuLink>

						<DropdownMenuSeparator />

						<DropdownMenuLink to="/account">Account</DropdownMenuLink>
						{hasSufficientAdminRole("users", administrator_role) && (
							<DropdownMenuLink to="/administration">
								Administration{" "}
							</DropdownMenuLink>
						)}
						<DropdownMenuItem onSelect={onLogout}>Logout</DropdownMenuItem>
					</DropdownMenuContent>
				</Dropdown>
			</div>

			<AboutDialog open={aboutOpen} setOpen={setAboutOpen} />
		</nav>
	);
}
