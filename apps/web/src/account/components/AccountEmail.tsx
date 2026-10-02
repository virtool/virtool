import Alert from "@base/Alert";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import Label from "@base/Label";
import Link from "@base/Link";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { Mail } from "lucide-react";
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
	/** Whether the current address is verified */
	emailVerified: boolean;
	/** An address waiting for verification */
	pendingEmail: string | null;
	/** Whether the user can set up email delivery */
	canManageEmail: boolean;
};

type EmailStatusProps = Pick<
	EmailProps,
	"email" | "emailVerified" | "pendingEmail"
>;

function EmailStatus({ email, emailVerified, pendingEmail }: EmailStatusProps) {
	return (
		<>
			<div className="flex items-center gap-2">
				<span className="font-medium">
					{email || "No email address on file."}
				</span>
				{email && (
					<Label color={emailVerified ? "green" : "gray"}>
						{emailVerified ? "Verified" : "Not verified"}
					</Label>
				)}
			</div>
			{pendingEmail && (
				<Alert outerClassName="mt-4 mb-0" color="blue" icon={Mail}>
					<span>
						We sent a verification link to <strong>{pendingEmail}</strong>. Your
						current address stays active until you open the link.
					</span>
				</Alert>
			)}
		</>
	);
}

type EmailUnavailableProps = Pick<
	EmailProps,
	"canManageEmail" | "email" | "emailVerified" | "pendingEmail"
>;

function EmailUnavailable({
	canManageEmail,
	email,
	emailVerified,
	pendingEmail,
}: EmailUnavailableProps) {
	return (
		<BoxGroup>
			<BoxGroupSection>
				<EmailStatus
					email={email}
					emailVerified={emailVerified}
					pendingEmail={pendingEmail}
				/>
				<p className="mt-2 mb-0 text-gray-600">
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
 * Shows the account's email address and its verification state, with a form to
 * change it.
 */
export default function AccountEmail({
	canManageEmail,
	deliveryAvailable,
	email,
	emailVerified,
	pendingEmail,
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
					<BoxGroupSection>
						<EmailStatus
							email={email}
							emailVerified={emailVerified}
							pendingEmail={pendingEmail}
						/>
					</BoxGroupSection>
					<form onSubmit={handleSubmit(onSubmit)}>
						<BoxGroupSection>
							<Field>
								<FieldLabel>New Email Address</FieldLabel>
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
				<EmailUnavailable
					canManageEmail={canManageEmail}
					email={email}
					emailVerified={emailVerified}
					pendingEmail={pendingEmail}
				/>
			)}
		</section>
	);
}
