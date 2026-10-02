import CopyField from "@base/CopyField";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@base/Dialog";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import { useState } from "react";
import { useForm } from "react-hook-form";
import QRCode from "react-qr-code";
import { useConfirmTotp, useEnableTotp } from "../queries";
import {
	getTotpSecret,
	getTwoFactorErrorMessage,
	type TotpEnrollment,
} from "../twoFactor";
import TwoFactorPassword from "./TwoFactorPassword";
import TwoFactorRecoveryCodes from "./TwoFactorRecoveryCodes";

type CodeFormValues = {
	code: string;
};

type TwoFactorCodeProps = {
	enrollment: TotpEnrollment;
	onConfirmed: () => void;
};

function TwoFactorCode({ enrollment, onConfirmed }: TwoFactorCodeProps) {
	const mutation = useConfirmTotp();
	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<CodeFormValues>({ defaultValues: { code: "" } });

	function onSubmit({ code }: CodeFormValues) {
		mutation.mutate({ code }, { onSuccess: onConfirmed });
	}

	return (
		<>
			<div className="flex justify-center rounded-md bg-white p-4">
				<QRCode
					aria-label="QR code for your authenticator app"
					role="img"
					size={180}
					value={enrollment.totpURI}
				/>
			</div>
			<CopyField label="Setup key" value={getTotpSecret(enrollment.totpURI)} />
			<form onSubmit={handleSubmit(onSubmit)}>
				<Field>
					<FieldLabel>Code</FieldLabel>
					<Input
						autoComplete="one-time-code"
						aria-required
						inputMode="numeric"
						maxLength={6}
						{...register("code", {
							required: "Enter the code from your authenticator app",
							pattern: {
								value: /^\d{6}$/,
								message: "Enter the 6-digit code",
							},
						})}
					/>
					<FieldError
						errors={[
							errors.code,
							mutation.isError
								? { message: getTwoFactorErrorMessage(mutation.error) }
								: undefined,
						]}
					/>
				</Field>
				<DialogFooter>
					<SaveButton altText="Turn on" disabled={mutation.isPending} />
				</DialogFooter>
			</form>
		</>
	);
}

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
