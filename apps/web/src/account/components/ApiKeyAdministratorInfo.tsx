import Alert from "@base/Alert";
import QueryError from "@base/QueryError";
import { hasSufficientAdminRole } from "@virtool/contracts";
import { useFetchAccount } from "../account";

/**
 * Displays a banner with information for an admin user
 */
export default function ApiKeyAdministratorInfo() {
	const { data, isError, isPending } = useFetchAccount();

	if (isError && !data) {
		return <QueryError noun="account" />;
	}

	if (
		!isPending &&
		data &&
		hasSufficientAdminRole("base", data.administratorRole)
	) {
		return (
			<Alert color="purple">
				<div>
					<p>
						<strong>
							You are an administrator and can create API keys with any
							permissions granted by that role.
						</strong>
					</p>
					<p>
						If your administrator role is reduced or removed, this API key will
						revert to your new limited set of permissions.
					</p>
				</div>
			</Alert>
		);
	}
}
