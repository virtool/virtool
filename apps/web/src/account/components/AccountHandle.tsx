import { BoxGroup, BoxGroupSection } from "@base/Box";
import Field, { FieldError } from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { useForm } from "react-hook-form";
import { useUpdateHandle } from "../queries";

type FormValues = {
	handle: string;
};

type HandleProps = {
	/** The users current handle */
	handle: string;
};

/**
 * A component to update the account's handle
 */
export default function AccountHandle({ handle }: HandleProps) {
	// `values` re-syncs the input when the handle prop changes after a successful
	// update and refetch. Unlike a `reset()` effect, it deep-compares, so a
	// re-render that leaves the handle untouched cannot wipe a validation error.
	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>({ values: { handle } });
	const mutation = useUpdateHandle();

	function onSubmit(values: FormValues) {
		mutation.mutate({ handle: values.handle });
	}

	return (
		<section>
			<SectionHeader level={3}>
				<h3>Handle</h3>
				<p>The name other users see on your work in Virtool.</p>
			</SectionHeader>
			<BoxGroup>
				<form onSubmit={handleSubmit(onSubmit)}>
					<BoxGroupSection>
						<Field>
							<Input
								aria-label="Handle"
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
						<footer className="flex items-center justify-end mb-4">
							<SaveButton altText="Change" />
						</footer>
					</BoxGroupSection>
				</form>
			</BoxGroup>
		</section>
	);
}
