import { BoxGroup, BoxGroupSection } from "@base/Box";
import Field, { FieldError } from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { useUpdateUser } from "@users/queries";
import { useForm } from "react-hook-form";

type HandleProps = {
	/** The users unique id */
	id: number;
	/** The users current handle */
	handle: string;
};

type FormValues = {
	handle: string;
};

/**
 * The handle view to change a user's handle
 */
export default function Handle({ id, handle }: HandleProps) {
	const mutation = useUpdateUser();
	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>({ values: { handle } });

	return (
		<section>
			<SectionHeader level={3}>
				<h3>Change Handle</h3>
				<p>The username this person signs in with.</p>
			</SectionHeader>
			<BoxGroup>
				<BoxGroupSection>
					<form
						onSubmit={handleSubmit((values) =>
							mutation.mutate({
								userId: id,
								update: { handle: values.handle },
							}),
						)}
					>
						<Field>
							<Input
								aria-label="handle"
								autoComplete="off"
								aria-required
								{...register("handle", {
									required: "Please specify a username",
								})}
							/>
							<FieldError
								errors={[
									errors.handle,
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
