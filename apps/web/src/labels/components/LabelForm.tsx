import Box from "@base/Box";
import Button from "@base/Button";
import Color from "@base/Color";
import { DialogFooter } from "@base/Dialog";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import SampleLabel from "@samples/components/Label/SampleLabel";
import { DEFAULT_LABEL_COLOR } from "@virtool/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";

type LabelFormProps = {
	color?: string;
	description?: string;
	error?: string;
	name?: string;
	onSubmit: (data: {
		color: string;
		name: string;
		description: string;
	}) => void;
};

/**
 * A form for creating or updating a label
 */
export function LabelForm({
	color = DEFAULT_LABEL_COLOR,
	description = "",
	error = "",
	name = "",
	onSubmit,
}: LabelFormProps) {
	const [newColor, setColor] = useState(color);

	const {
		formState: { errors },
		register,
		handleSubmit,
		watch,
	} = useForm({ defaultValues: { color, description, name } });

	return (
		<form
			onSubmit={handleSubmit((values) =>
				onSubmit({ ...values, color: newColor || DEFAULT_LABEL_COLOR }),
			)}
		>
			<Field>
				<FieldLabel>Name</FieldLabel>
				<Input
					aria-required
					{...register("name", { required: "Name is required." })}
				/>
				<FieldError
					errors={[errors.name, error ? { message: error } : undefined]}
				/>
			</Field>
			<Field>
				<FieldLabel>Description</FieldLabel>
				<Input {...register("description")} />
			</Field>
			<Field>
				<FieldLabel>Color</FieldLabel>
				<Color value={newColor} onChange={(color) => setColor(color)} />
			</Field>
			<p className="font-medium">Preview</p>
			<Box className="p-2.5">
				<SampleLabel
					color={newColor || DEFAULT_LABEL_COLOR}
					name={watch("name") || "Preview"}
				/>
			</Box>
			<DialogFooter>
				<Button color="blue" type="submit">
					Save
				</Button>
			</DialogFooter>
		</form>
	);
}
