import TwoFactorCode from "@account/components/TwoFactorCode";
import TwoFactorPassword from "@account/components/TwoFactorPassword";
import TwoFactorRecoveryCodes from "@account/components/TwoFactorRecoveryCodes";
import { useEnableTotp, useLogout } from "@account/queries";
import type { TotpEnrollment } from "@account/twoFactor";
import Button from "@base/Button";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { useFollowAuthNextStep } from "../hooks";
import { WallContainer } from "./WallContainer";
import { WallTitle } from "./WallTitle";

const routeApi = getRouteApi("/mfa-enrollment");

type Step = "password" | "code" | "codes";

const STEP_TEXT: Record<Step, { title: string; subtitle: string }> = {
	password: {
		title: "Set up two-factor authentication",
		subtitle:
			"This Virtool instance requires two-factor authentication. Enter your password to start.",
	},
	code: {
		title: "Connect your authenticator app",
		subtitle:
			"Scan the QR code with your authenticator app, or enter the setup key. Then enter the code that the app shows.",
	},
	codes: {
		title: "Save your recovery codes",
		subtitle:
			"Two-factor authentication is on. If you leave before you save these codes, make new ones in your account security settings.",
	},
};

/**
 * The wall for a user who must turn on TOTP before they can use Virtool.
 *
 * The secret and the recovery codes live only in this component's state, so
 * they go when it unmounts.
 */
export default function MfaEnrollment() {
	const { redirect } = routeApi.useSearch();
	const enableMutation = useEnableTotp();
	const logoutMutation = useLogout();
	const follow = useFollowAuthNextStep();
	const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
	const [confirmed, setConfirmed] = useState(false);
	const [acknowledged, setAcknowledged] = useState(false);
	const [continuing, setContinuing] = useState(false);
	const [continueError, setContinueError] = useState(false);

	const step: Step =
		enrollment === null ? "password" : confirmed ? "codes" : "code";
	const { title, subtitle } = STEP_TEXT[step];

	function onPassword(password: string) {
		enableMutation.mutate({ password }, { onSuccess: setEnrollment });
	}

	async function onDone() {
		if (continuing) {
			return;
		}
		setContinuing(true);
		setContinueError(false);
		try {
			await follow(redirect);
		} catch {
			setContinueError(true);
			setContinuing(false);
		}
	}

	return (
		<WallContainer>
			<WallTitle title={title} subtitle={subtitle} />
			{step === "password" && (
				<TwoFactorPassword
					error={enableMutation.error}
					isPending={enableMutation.isPending}
					onSubmit={onPassword}
					submitLabel="Continue"
				/>
			)}
			{step === "code" && enrollment && (
				<TwoFactorCode
					enrollment={enrollment}
					onConfirmed={() => setConfirmed(true)}
				/>
			)}
			{step === "codes" && enrollment && (
				<>
					<TwoFactorRecoveryCodes
						acknowledged={acknowledged}
						codes={enrollment.backupCodes}
						onAcknowledgedChange={setAcknowledged}
						onDone={() => void onDone()}
					/>
					{continueError && (
						<p role="alert" className="mt-2 font-medium text-red-600">
							Virtool could not be reached. Try again.
						</p>
					)}
				</>
			)}
			{step !== "codes" && (
				<div className="mt-6 border-t border-gray-200 pt-6">
					<Button
						disabled={logoutMutation.isPending}
						onClick={() => logoutMutation.mutate()}
					>
						Cancel and sign out
					</Button>
				</div>
			)}
		</WallContainer>
	);
}
