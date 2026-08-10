import BoxGroup from "@base/BoxGroup";
import BoxGroupHeader from "@base/BoxGroupHeader";
import BoxGroupSection from "@base/BoxGroupSection";
import InputError from "@base/InputError";
import InputGroup from "@base/InputGroup";
import InputLabel from "@base/InputLabel";
import InputSimple from "@base/InputSimple";
import SaveButton from "@base/SaveButton";
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
		mutation.mutate({ email });
	}

	return (
		<BoxGroup>
			<BoxGroupHeader>
				<h2>Email</h2>
			</BoxGroupHeader>
			<form onSubmit={handleSubmit(onSubmit)}>
				<BoxGroupSection>
					<InputGroup>
						<InputLabel htmlFor="email">Email Address</InputLabel>
						<InputSimple
							id="email"
							aria-invalid={Boolean(errors.email) || undefined}
							aria-describedby={errors.email ? "email-error" : undefined}
							{...register("email", {
								pattern: {
									value: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/,
									message: "Please provide a valid email address",
								},
							})}
						/>
						<InputError id="email-error">{errors.email?.message}</InputError>
					</InputGroup>
					<footer className="flex items-center justify-end mb-4">
						<SaveButton altText="Change" />
					</footer>
				</BoxGroupSection>
			</form>
		</BoxGroup>
	);
}
