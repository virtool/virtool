import { InitialIcon } from "@base/Icon";
import Label from "@base/Label";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SectionHeader from "@base/SectionHeader";
import { useQuery } from "@tanstack/react-query";
import { hasSufficientAdminRole } from "@virtool/contracts";
import { ShieldUser } from "lucide-react";
import { useFetchAccount } from "../account";
import { emailDeliveryQueryOptions } from "../queries";
import AccountEmail from "./AccountEmail";
import AccountHandle from "./AccountHandle";
import AccountPassword from "./AccountPassword";

/**
 * Displays the account's identity with options to change the handle, password,
 * and email
 */
export default function AccountProfile() {
	const { data, isPending, isError } = useFetchAccount();
	const emailDelivery = useQuery(emailDeliveryQueryOptions());

	if (isError && !data) {
		return <QueryError noun="your account" />;
	}

	if (isPending || emailDelivery.isPending) {
		return <LoadingPlaceholder />;
	}

	const { administratorRole, email, handle, lastPasswordChange } = data;

	return (
		<section className="flex flex-col gap-4">
			<SectionHeader className="mb-0">
				<h2>Profile</h2>
				<p>Change your handle, password, and email address.</p>
			</SectionHeader>
			<div className="flex items-center justify-between">
				<div className="flex font-medium items-center gap-4 text-2xl">
					<InitialIcon handle={handle} size="xxl" />
					<span>{handle}</span>
				</div>
				{administratorRole && (
					<Label className="capitalize text-base" color="purple">
						<ShieldUser />
						{administratorRole} Administrator
					</Label>
				)}
			</div>
			<AccountHandle handle={handle} />
			<AccountPassword lastPasswordChange={lastPasswordChange} />
			<AccountEmail
				canManageEmail={hasSufficientAdminRole("full", administratorRole)}
				deliveryAvailable={emailDelivery.data?.available ?? true}
				email={email}
			/>
		</section>
	);
}
