import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SectionHeader from "@base/SectionHeader";
import { useQuery } from "@tanstack/react-query";
import { hasSufficientAdminRole } from "@virtool/contracts";
import { useFetchAccount } from "../account";
import {
	accountSecurityQueryOptions,
	emailDeliveryQueryOptions,
} from "../queries";
import AccountEmail from "./AccountEmail";
import AccountPasskeys from "./AccountPasskeys";
import AccountPassword from "./AccountPassword";
import AccountSessions from "./AccountSessions";
import AccountTwoFactor from "./AccountTwoFactor";

type AccountEmailSectionProps = {
	canManageEmail: boolean;
	email: string;
};

function AccountEmailSection({
	canManageEmail,
	email,
}: AccountEmailSectionProps) {
	const security = useQuery(accountSecurityQueryOptions());
	const emailDelivery = useQuery(emailDeliveryQueryOptions());

	if (security.isError && !security.data) {
		return (
			<section>
				<SectionHeader level={3}>
					<h3>Email</h3>
				</SectionHeader>
				<QueryError noun="your email address" />
			</section>
		);
	}

	if (security.isPending || emailDelivery.isPending) {
		return <LoadingPlaceholder />;
	}

	return (
		<AccountEmail
			canManageEmail={canManageEmail}
			deliveryAvailable={emailDelivery.data?.available ?? true}
			email={email}
			emailVerified={security.data.emailVerified}
			pendingEmail={security.data.pendingEmail}
		/>
	);
}

/**
 * Displays the account's sign-in controls: email, password, two-factor
 * authentication, passkeys, and browser sessions.
 */
export default function AccountSecurity() {
	const { data, isPending, isError } = useFetchAccount();

	if (isError && !data) {
		return <QueryError noun="your account" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	const { administratorRole, email, handle, lastPasswordChange } = data;

	return (
		<section className="flex flex-col gap-4">
			<SectionHeader className="mb-0">
				<h2>Security</h2>
				<p>
					Manage how you sign in, and the browsers that are signed in to your
					account.
				</p>
			</SectionHeader>
			<AccountEmailSection
				canManageEmail={hasSufficientAdminRole("full", administratorRole)}
				email={email}
			/>
			<AccountPassword lastPasswordChange={lastPasswordChange} />
			<AccountTwoFactor />
			<AccountPasskeys handle={handle} />
			<AccountSessions />
		</section>
	);
}
