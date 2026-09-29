import { BoxGroup, BoxGroupSection } from "@base/Box";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import Link from "@base/Link";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { useForm } from "react-hook-form";
import { useUpdateAccount } from "../queries";

type FormValues = {
	email: string;
};

type EmailProps = {
	/** Whether this instance can send the verification email */
	deliveryAvailable: boolean;
	/** The user's current email address, or `""` if they have none on file */
	email: string;
	/** Whether the user can set up email delivery */
	canManageEmail: boolean;
};

type EmailUnavailableProps = Pick<EmailProps, "canManageEmail" | "email">;

function EmailUnavailable({ canManageEmail, email }: EmailUnavailableProps) {
	return (
		<BoxGroup>
			<BoxGroupSection>
				<p className="font-medium">{email || "No email address on file."}</p>
				<p className="mt-2 text-gray-600">
					Email delivery is not set up for this Virtool instance.{" "}
					{canManageEmail ? (
						<>
							<Link className="underline" to="/administration/email">
								Set up email delivery
							</Link>{" "}
							to add or change your address.
						</>
					) : (
						"Ask an administrator to set it up if you want to add or change your address."
					)}
				</p>
			</BoxGroupSection>
		</BoxGroup>
	);
}

/**
 * A component to update the accounts email address
 */
export default function AccountEmail({
	canManageEmail,
	deliveryAvailable,
	email,
}: EmailProps) {
	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>({ defaultValues: { email } });
	const mutation = useUpdateAccount();

	function onSubmit({ email }: FormValues) {
		if (!mutation.isPending) {
			mutation.mutate({ email });
		}
	}

	return (
		<section>
			<SectionHeader level={3}>
				<h3>Email</h3>
			</SectionHeader>
			{deliveryAvailable ? (
				<BoxGroup>
					<form onSubmit={handleSubmit(onSubmit)}>
						<BoxGroupSection>
							<Field>
								<FieldLabel>Email Address</FieldLabel>
								<Input
									{...register("email", {
										required: "Please provide an email address",
										pattern: {
											value: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/,
											message: "Please provide a valid email address",
										},
									})}
								/>
								<FieldError errors={[errors.email]} />
							</Field>
							{mutation.isSuccess && (
								<p role="status">
									A verification link has been queued. Your current address
									stays active until you verify the new one.
								</p>
							)}
							{mutation.isError && (
								<p role="alert">
									Could not start email verification. Try again.
								</p>
							)}
							<footer className="flex items-center justify-end mb-4">
								<SaveButton
									altText="Send verification"
									disabled={mutation.isPending}
								/>
							</footer>
						</BoxGroupSection>
					</form>
				</BoxGroup>
			) : (
				<EmailUnavailable canManageEmail={canManageEmail} email={email} />
			)}
		</section>
	);
}
