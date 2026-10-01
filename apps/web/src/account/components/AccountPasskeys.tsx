import { getPasskeyNotice, usePasskeySupport } from "@app/passkeys";
import Alert from "@base/Alert";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SectionHeader from "@base/SectionHeader";
import { useQuery } from "@tanstack/react-query";
import { Info, TriangleAlert } from "lucide-react";
import { passkeysQueryOptions, useRegisterPasskey } from "../queries";
import AccountPasskeyItem from "./AccountPasskeyItem";

function PasskeyList() {
	const { data, isPending, isError } = useQuery(passkeysQueryOptions());

	if (isError && !data) {
		return <QueryError noun="your passkeys" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	if (data.length === 0) {
		return (
			<BoxGroupSection className="text-gray-600">
				You have not added any passkeys.
			</BoxGroupSection>
		);
	}

	return data.map((passkey) => (
		<AccountPasskeyItem key={passkey.managementId} passkey={passkey} />
	));
}

type AccountPasskeysProps = {
	/** The handle that names new passkeys in the authenticator. */
	handle: string;
};

/**
 * Lists the account's passkeys and adds new ones.
 *
 * A passkey is an optional way to sign in beside the password, never a
 * replacement for it.
 */
export default function AccountPasskeys({ handle }: AccountPasskeysProps) {
	const support = usePasskeySupport();
	const registerMutation = useRegisterPasskey();

	const registerNotice = registerMutation.isError
		? getPasskeyNotice(registerMutation.error)
		: null;
	const isRegisterError = registerNotice?.tone === "error";

	return (
		<section aria-labelledby="account-passkeys">
			<SectionHeader level={3}>
				<h3 id="account-passkeys">Passkeys</h3>
				<p>
					Sign in with your fingerprint, face, or device PIN. You can always
					sign in with your password too.
				</p>
			</SectionHeader>
			<BoxGroup>
				<BoxGroupSection>
					<div className="flex items-center justify-between gap-4">
						<span>Add a passkey for this browser or device.</span>
						<Button
							color="blue"
							disabled={support !== "available" || registerMutation.isPending}
							onClick={() => registerMutation.mutate(handle)}
						>
							{registerMutation.isPending ? "Adding…" : "Add"}
						</Button>
					</div>
					{support === "unavailable" && (
						<Alert
							outerClassName="mt-4 mb-0"
							color="orange"
							icon={TriangleAlert}
						>
							This browser cannot use passkeys here. Passkeys need a supported
							browser and a secure (HTTPS) connection.
						</Alert>
					)}
					{registerNotice && (
						<div role={isRegisterError ? "alert" : "status"}>
							<Alert
								outerClassName="mt-4 mb-0"
								color={isRegisterError ? "red" : "gray"}
								icon={isRegisterError ? TriangleAlert : Info}
							>
								{registerNotice.message}
							</Alert>
						</div>
					)}
				</BoxGroupSection>
				<PasskeyList />
			</BoxGroup>
		</section>
	);
}
