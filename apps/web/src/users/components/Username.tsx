import { registerUsernameInput } from "@app/usernameInput";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Field, { FieldError } from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { useUpdateUser } from "@users/queries";
import { useForm } from "react-hook-form";

type UsernameProps = {
	/** The user's unique ID */
	id: number;
	/** The user's current username */
	username: string;
};

type FormValues = {
	username: string;
};

/**
 * The username view to change a user's username
 */
export default function Username({ id, username }: UsernameProps) {
	const mutation = useUpdateUser();
	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>({ values: { username } });

	return (
		<section>
			<SectionHeader level={3}>
				<h3>Change Username</h3>
				<p>The username this person signs in with.</p>
			</SectionHeader>
			<BoxGroup>
				<BoxGroupSection>
					<form
						onSubmit={handleSubmit((values) =>
							mutation.mutate({
								userId: id,
								update: { username: values.username },
							}),
						)}
					>
						<Field>
							<Input
								aria-label="Username"
								autoComplete="off"
								aria-required
								{...registerUsernameInput(
									register("username", {
										required: "Please specify a username",
									}),
								)}
							/>
							<FieldError
								errors={[
									errors.username,
									mutation.isError
										? { message: mutation.error.message }
										: undefined,
								]}
							/>
						</Field>

						<div className="flex items-center justify-end">
							<SaveButton />
						</div>
					</form>
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
