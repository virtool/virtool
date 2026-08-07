import InitialIcon from "@base/InitialIcon";
import Label from "@base/Label";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import { ShieldUser } from "lucide-react";
import { useFetchAccount } from "../account";
import AccountEmail from "./AccountEmail";
import AccountGroups from "./AccountGroups";
import AccountHandle from "./AccountHandle";
import AccountPassword from "./AccountPassword";

/**
 * Displays information related to the users account with options to reset password and email
 */
export default function AccountProfile() {
	const { data, isPending, isError } = useFetchAccount();

	if (isError && !data) {
		return <QueryError noun="your account" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	const { administratorRole, email, groups, handle, lastPasswordChange } = data;

	return (
		<>
			<div className="flex items-center justify-between mb-6">
				<header className="flex font-medium items-center gap-4 text-2xl">
					<InitialIcon handle={handle} size="xxl" />
					<h3>{handle}</h3>
				</header>

				<div>
					{administratorRole && (
						<Label
							key="administrator"
							className="capitalize text-base ml-auto"
							color="purple"
						>
							<ShieldUser />
							{administratorRole} Administrator
						</Label>
					)}
				</div>
			</div>

			<AccountHandle handle={handle} />
			<AccountPassword lastPasswordChange={lastPasswordChange} />
			<AccountEmail email={email} />
			<AccountGroups groups={groups} />
		</>
	);
}
