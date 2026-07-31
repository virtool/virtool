import Button from "@base/Button";
import { DialogFooter } from "@base/Dialog";
import InputError from "@base/InputError";
import InputGroup from "@base/InputGroup";
import InputLabel from "@base/InputLabel";
import InputSimple from "@base/InputSimple";
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
			<InputGroup>
				<InputLabel htmlFor="message">Message</InputLabel>
				<InputSimple
					id="message"
					aria-required
					aria-invalid={Boolean(errors.message) || Boolean(error) || undefined}
					aria-describedby={
						errors.message || error ? "message-error" : undefined
					}
					{...register("message", { required: "Message is required." })}
				/>
				<InputError id="message-error">
					{errors.message?.message || error}
				</InputError>
			</InputGroup>
			<InputGroup>
				<InputLabel id="color-label">Color</InputLabel>
				<Controller
					control={control}
					name="color"
					render={({ field }) => (
						<BannerColorPicker
							aria-labelledby="color-label"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
			</InputGroup>
			<DialogFooter>
				<Button color="blue" type="submit">
					{submitLabel}
				</Button>
			</DialogFooter>
		</form>
	);
}
