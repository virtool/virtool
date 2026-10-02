import Button from "@base/Button";
import { DialogFooter } from "@base/Dialog";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import type { BannerColor } from "@virtool/contracts";
import { Controller, useForm } from "react-hook-form";
import BannerColorPicker from "./BannerColorPicker";

/** Values produced by the banner form. */
export type BannerFormValues = {
	color: BannerColor;
	message: string;
};

type BannerFormProps = {
	color?: BannerColor;
	error?: string;
	message?: string;
	onSubmit: (values: BannerFormValues) => void;
	submitLabel?: string;
};

/**
 * Form for creating or editing a banner. Shared between the create and edit
 * dialogs.
 */
export default function BannerForm({
	color = "red",
	error = "",
	message = "",
	onSubmit,
	submitLabel = "Save",
}: BannerFormProps) {
	const {
		control,
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<BannerFormValues>({
		defaultValues: { color, message },
	});

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Field>
				<FieldLabel>Message</FieldLabel>
				<Input
					aria-required
					{...register("message", { required: "Message is required." })}
				/>
				<FieldError errors={[errors.message]}>
					{errors.message ? undefined : error}
				</FieldError>
			</Field>
			<Controller
				control={control}
				name="color"
				render={({ field }) => (
					<BannerColorPicker value={field.value} onChange={field.onChange} />
				)}
			/>
			<DialogFooter>
				<Button color="blue" type="submit">
					{submitLabel}
				</Button>
			</DialogFooter>
		</form>
	);
}
