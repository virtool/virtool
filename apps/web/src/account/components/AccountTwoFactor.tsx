import Alert from "@base/Alert";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import Label from "@base/Label";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SectionHeader from "@base/SectionHeader";
import { useQuery } from "@tanstack/react-query";
import type { AccountSecurity } from "@virtool/contracts";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { accountSecurityQueryOptions, passkeysQueryOptions } from "../queries";
import { getRecoveryCodesWarning } from "../recoveryCodes";
import TwoFactorDisable from "./TwoFactorDisable";
import TwoFactorRegenerate from "./TwoFactorRegenerate";
import TwoFactorSetup from "./TwoFactorSetup";

type TwoFactorStatusProps = {
	onSetUp: () => void;
	security: AccountSecurity;
};

function TwoFactorStatus({ onSetUp, security }: TwoFactorStatusProps) {
	const { mfaRequired, twoFactorEnabled } = security;
	const recoveryCodesWarning = getRecoveryCodesWarning(security);
	const { data: passkeys } = useQuery(passkeysQueryOptions());

	// A passkey also satisfies the required policy. While the list is unknown,
	// assume that turning TOTP off restricts the session.
	const disableRestrictsSession = mfaRequired && !passkeys?.length;

	return (
		<>
			{recoveryCodesWarning && (
				<Alert color="orange" icon={TriangleAlert}>
					{recoveryCodesWarning}
				</Alert>
			)}
			<BoxGroup>
				<BoxGroupSection className="flex items-center justify-between gap-4">
					<div className="flex flex-col gap-1">
						<div className="flex items-center gap-2">
							<span className="font-medium text-base">Authenticator app</span>
							<Label color={twoFactorEnabled ? "green" : "gray"}>
								{twoFactorEnabled ? "On" : "Off"}
							</Label>
						</div>
						{mfaRequired && (
							<span className="text-gray-600 text-sm">
								This Virtool instance requires two-factor authentication or a
								passkey.
							</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						{twoFactorEnabled ? (
							<>
								<TwoFactorRegenerate />
								<TwoFactorDisable restrictsSession={disableRestrictsSession} />
							</>
						) : (
							<Button color="blue" size="medium" onClick={onSetUp}>
								Set up
							</Button>
						)}
					</div>
				</BoxGroupSection>
			</BoxGroup>
		</>
	);
}

/**
 * Shows whether TOTP is on, with controls to set it up, replace the recovery
 * codes, or turn it off.
 */
export default function AccountTwoFactor() {
	const { data, isPending, isError } = useQuery(accountSecurityQueryOptions());
	const [setupOpen, setSetupOpen] = useState(false);

	return (
		<section aria-labelledby="account-two-factor">
			<SectionHeader level={3}>
				<h3 id="account-two-factor">Two-factor authentication</h3>
				<p>
					Enter a code from an authenticator app when you sign in with your
					password.
				</p>
			</SectionHeader>
			{isError && !data ? (
				<QueryError noun="your two-factor authentication" />
			) : isPending ? (
				<LoadingPlaceholder />
			) : (
				<TwoFactorStatus onSetUp={() => setSetupOpen(true)} security={data} />
			)}
			{/* Kept mounted while TOTP turns on, so the recovery codes stay visible. */}
			<TwoFactorSetup open={setupOpen} onOpenChange={setSetupOpen} />
		</section>
	);
}
