import { BoxGroup, BoxGroupSection } from "@base/Box";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { useForm } from "react-hook-form";
import { useUpdateAccount } from "../queries";

type FormValues = {
	email: string;
};

type EmailProps = {
	/** The user's current email address, or `""` if they have none on file */
	email: string;
};

/**
 * A component to update the accounts email address
 */
export default function AccountEmail({ email }: EmailProps) {
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
			<SectionHeader>
				<h2>Email</h2>
			</SectionHeader>
			<BoxGroup>
				<form onSubmit={handleSubmit(onSubmit)}>
					<BoxGroupSection>
						<InputGroup>
							<InputLabel htmlFor="email">Email Address</InputLabel>
							<InputSimple
								id="email"
								aria-invalid={Boolean(errors.email) || undefined}
								aria-describedby={errors.email ? "email-error" : undefined}
								{...register("email", {
									required: "Please provide an email address",
									pattern: {
										value: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/,
										message: "Please provide a valid email address",
									},
								})}
							/>
							<InputError id="email-error">{errors.email?.message}</InputError>
						</InputGroup>
						{mutation.isSuccess && (
							<p role="status">
								A verification link has been queued. Your current address stays
								active until you verify the new one.
							</p>
						)}
						{mutation.isError && (
							<p role="alert">Could not start email verification. Try again.</p>
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
		</section>
	);
}
