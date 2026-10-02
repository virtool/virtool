import CopyField from "@base/CopyField";
import { DialogFooter } from "@base/Dialog";
import Field, { FieldError, FieldLabel } from "@base/Field";
import { InputOTP } from "@base/Input";
import SaveButton from "@base/SaveButton";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Controller, useForm } from "react-hook-form";
import QRCode from "react-qr-code";
import { useConfirmTotp } from "../queries";
import {
	getTotpSecret,
	getTwoFactorErrorMessage,
	type TotpEnrollment,
} from "../twoFactor";

type CodeFormValues = {
	code: string;
};

type TwoFactorCodeProps = {
	enrollment: TotpEnrollment;
	onConfirmed: () => void;
};

/**
 * The QR code and setup key for a new TOTP secret, and the code check that
 * turns TOTP on.
 */
export default function TwoFactorCode({
	enrollment,
	onConfirmed,
}: TwoFactorCodeProps) {
	const mutation = useConfirmTotp();
	const {
		control,
		formState: { errors },
		handleSubmit,
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
					<Controller
						name="code"
						control={control}
						rules={{
							required: "Enter the code from your authenticator app",
							pattern: {
								value: /^\d{6}$/,
								message: "Enter the 6-digit code",
							},
						}}
						render={({ field }) => (
							<InputOTP
								autoComplete="one-time-code"
								aria-required
								inputMode="numeric"
								length={6}
								pattern={REGEXP_ONLY_DIGITS}
								{...field}
							/>
						)}
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
