import Attribution from "@base/Attribution";
import Badge from "@base/Badge";
import Box from "@base/Box";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@base/Dialog";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import { useCloneReference } from "@references/queries";
import type { ReferenceMinimal } from "@virtool/contracts";
import { useForm } from "react-hook-form";

type FormValues = {
	name: string;
};

type CloneReferenceProps = {
	cloneReferenceId?: string;
	/** A list of minimal references */
	references: ReferenceMinimal[];
	unsetCloneReferenceId: () => void;
};

/**
 * Displays a form used for creating a clone of a reference
 */
export default function CloneReference({
	cloneReferenceId,
	references,
	unsetCloneReferenceId,
}: CloneReferenceProps) {
	const reference = references.find(
		(reference) => String(reference.id) === cloneReferenceId,
	);

	const {
		formState: { errors },
		register,
		handleSubmit,
	} = useForm<FormValues>({
		values: { name: reference ? `Clone of ${reference.name}` : "" },
	});

	const mutation = useCloneReference();

	function onSubmit({ name }: FormValues) {
		if (!reference) {
			return;
		}

		mutation.mutate(
			{
				name,
				description: `Cloned from ${reference.name}`,
				refId: reference.id,
			},
			{
				onSuccess: () => {
					unsetCloneReferenceId();
				},
			},
		);
	}

	return (
		<Dialog
			onOpenChange={() => unsetCloneReferenceId()}
			open={Boolean(cloneReferenceId)}
		>
			<DialogContent>
				<DialogTitle>Clone Reference</DialogTitle>
				<form onSubmit={handleSubmit(onSubmit)}>
					<dl>
						<dt className="font-medium mb-2">Selected reference</dt>
						<dd>
							{reference && (
								<Box className="flex items-center">
									<strong>{reference.name}</strong>
									<Badge className="ml-1.5">{reference.otuCount} OTUs</Badge>
									<Attribution
										className="ml-auto"
										time={reference.createdAt}
										user={reference.user?.handle}
									/>
								</Box>
							)}
						</dd>
					</dl>
					<Field>
						<FieldLabel>Name</FieldLabel>
						<Input
							aria-required
							{...register("name", {
								required: "Required Field",
							})}
						/>
						<FieldError errors={[errors.name]} />
					</Field>
					<DialogFooter>
						<SaveButton
							disabled={!references.length || !reference}
							altText="Clone"
						/>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
