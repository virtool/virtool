import { BoxGroup, BoxGroupSection } from "@base/Box";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
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
			<SectionHeader>
				<h2>Handle</h2>
			</SectionHeader>
			<BoxGroup>
				<form onSubmit={handleSubmit(onSubmit)}>
					<BoxGroupSection>
						<InputGroup>
							<InputLabel htmlFor="handle">Username</InputLabel>
							<InputSimple
								id="handle"
								autoComplete="off"
								aria-required
								aria-invalid={
									Boolean(errors.handle) || mutation.isError || undefined
								}
								aria-describedby={
									errors.handle || mutation.isError ? "handle-error" : undefined
								}
								{...register("handle", {
									required: "Please specify a username",
								})}
							/>
							<InputError id="handle-error">
								{errors.handle?.message ||
									(mutation.isError ? mutation.error.message : "")}
							</InputError>
						</InputGroup>
						<footer className="flex items-center justify-end mb-4">
							<SaveButton altText="Change" />
						</footer>
					</BoxGroupSection>
				</form>
			</BoxGroup>
		</section>
	);
}
