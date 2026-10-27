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
import { accountSecurityQueryOptions } from "../queries";
import TwoFactorDisable from "./TwoFactorDisable";
import TwoFactorRegenerate from "./TwoFactorRegenerate";
import TwoFactorSetup from "./TwoFactorSetup";

const LOW_RECOVERY_CODES = 3;

function getRecoveryCodesWarning(remaining: number): string {
	if (remaining === 0) {
		return "You have no recovery codes left. Make new codes so that you can sign in if you lose your authenticator app.";
	}

	return `Only ${remaining} recovery ${remaining === 1 ? "code is" : "codes are"} left. Make new codes so that you can sign in if you lose your authenticator app.`;
}

type TwoFactorStatusProps = {
	onSetUp: () => void;
	security: AccountSecurity;
};

function TwoFactorStatus({ onSetUp, security }: TwoFactorStatusProps) {
	const { mfaRequired, recoveryCodesRemaining, twoFactorEnabled } = security;

	return (
		<>
			{twoFactorEnabled &&
				recoveryCodesRemaining !== null &&
				recoveryCodesRemaining <= LOW_RECOVERY_CODES && (
					<Alert color="orange" icon={TriangleAlert}>
						{getRecoveryCodesWarning(recoveryCodesRemaining)}
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
								This Virtool instance requires two-factor authentication.
							</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						{twoFactorEnabled ? (
							<>
								<TwoFactorRegenerate />
								<TwoFactorDisable mfaRequired={mfaRequired} />
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
