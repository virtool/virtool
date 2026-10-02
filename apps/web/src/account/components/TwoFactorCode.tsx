import CopyField from "@base/CopyField";
import { DialogFooter } from "@base/Dialog";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import { useForm } from "react-hook-form";
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
