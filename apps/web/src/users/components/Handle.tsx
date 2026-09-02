import { BoxGroup, BoxGroupSection } from "@base/Box";
import {
	InputContainer,
	InputError,
	InputGroup,
	InputSimple,
} from "@base/Input";
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
			<SectionHeader>
				<h2>Change Handle</h2>
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
						<InputGroup>
							<InputContainer>
								<InputSimple
									aria-label="handle"
									id="handle"
									autoComplete="off"
									aria-required
									aria-invalid={
										Boolean(errors.handle) || mutation.isError || undefined
									}
									aria-describedby={
										errors.handle || mutation.isError
											? "handle-error"
											: undefined
									}
									{...register("handle", {
										required: "Please specify a username",
									})}
								/>
								<InputError id="handle-error">
									{errors.handle?.message ||
										(mutation.isError ? mutation.error.message : "")}
								</InputError>
							</InputContainer>
						</InputGroup>

						<div className="flex items-center justify-end">
							<SaveButton />
						</div>
					</form>
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
