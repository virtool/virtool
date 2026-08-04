import Box from "@base/Box";
import Button from "@base/Button";
import Color from "@base/Color";
import { DialogFooter } from "@base/Dialog";
import InputError from "@base/InputError";
import InputGroup from "@base/InputGroup";
import InputLabel from "@base/InputLabel";
import InputSimple from "@base/InputSimple";
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
			<InputGroup>
				<InputLabel htmlFor="name">Name</InputLabel>
				<InputSimple
					id="name"
					aria-required
					aria-invalid={Boolean(errors.name) || Boolean(error) || undefined}
					aria-describedby={errors.name || error ? "name-error" : undefined}
					{...register("name", { required: "Name is required." })}
				/>
				<InputError id="name-error">{errors.name?.message || error}</InputError>
			</InputGroup>
			<InputGroup>
				<InputLabel htmlFor="description">Description</InputLabel>
				<InputSimple
					id="description"
					aria-invalid={Boolean(errors.description) || undefined}
					{...register("description")}
				/>
			</InputGroup>
			<InputGroup>
				<InputLabel htmlFor="color">Color</InputLabel>
				<Color
					id="color"
					value={newColor}
					onChange={(color) => setColor(color)}
				/>
			</InputGroup>
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
