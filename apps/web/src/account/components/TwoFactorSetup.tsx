import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@base/Dialog";
import { useState } from "react";
import { useEnableTotp } from "../queries";
import type { TotpEnrollment } from "../twoFactor";
import TwoFactorCode from "./TwoFactorCode";
import TwoFactorPassword from "./TwoFactorPassword";
import TwoFactorRecoveryCodes from "./TwoFactorRecoveryCodes";

type SetupStep = "password" | "code" | "codes";

function getStepText(step: SetupStep) {
	if (step === "codes") {
		return {
			title: "Save your recovery codes",
			description: "Two-factor authentication is on.",
		};
	}

	return {
		title: "Set up two-factor authentication",
		description:
			step === "code"
				? "Scan the QR code with your authenticator app, or enter the setup key. Then enter the code that the app shows."
				: "Enter your password to continue.",
	};
}

type TwoFactorSetupProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/**
 * A dialog that sets up TOTP: a password check, then the QR code and a code
 * check, then the recovery codes.
 *
 * The secret and the recovery codes live only in this component's state.
 * TOTP turns on only after the code check.
 */
export default function TwoFactorSetup({
	open,
	onOpenChange,
}: TwoFactorSetupProps) {
	const enableMutation = useEnableTotp();
	const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
	const [confirmed, setConfirmed] = useState(false);
	const [acknowledged, setAcknowledged] = useState(false);

	const showCodes = enrollment !== null && confirmed;

	function handleOpenChange(next: boolean) {
		if (!next && showCodes && !acknowledged) {
			return;
		}

		if (!next) {
			setEnrollment(null);
			setConfirmed(false);
			setAcknowledged(false);
			enableMutation.reset();
		}

		onOpenChange(next);
	}

	function handlePassword(password: string) {
		enableMutation.mutate(
			{ password },
			{ onSuccess: (result) => setEnrollment(result) },
		);
	}

	const { title, description } = getStepText(
		showCodes ? "codes" : enrollment ? "code" : "password",
	);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
				{showCodes ? (
					<TwoFactorRecoveryCodes
						acknowledged={acknowledged}
						codes={enrollment.backupCodes}
						onAcknowledgedChange={setAcknowledged}
						onDone={() => handleOpenChange(false)}
					/>
				) : enrollment ? (
					<TwoFactorCode
						enrollment={enrollment}
						onConfirmed={() => setConfirmed(true)}
					/>
				) : (
					<TwoFactorPassword
						error={enableMutation.error}
						isPending={enableMutation.isPending}
						onSubmit={handlePassword}
						submitLabel="Continue"
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
