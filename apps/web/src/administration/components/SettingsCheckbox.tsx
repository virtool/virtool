import Box from "@base/Box";
import Checkbox from "@base/Checkbox";
import Field, {
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldTitle,
} from "@base/Field";
import type { ReactNode } from "react";

type SettingsCheckboxProps = {
	/** Text that explains what the setting does */
	description: ReactNode;

	/** Whether the setting is enabled */
	enabled: boolean;

	/** A callback function to handle checkbox toggling */
	onToggle: () => void;

	/** The name of the setting, which also names the checkbox */
	title: ReactNode;
};

/**
 * A setting row that the user toggles with a checkbox
 */
export default function SettingsCheckbox({
	description,
	enabled,
	onToggle,
	title,
}: SettingsCheckboxProps) {
	return (
		<Box className="px-5 py-4">
			<FieldLabel variant="row">
				<Field className="flex-1 gap-5" orientation="horizontal">
					<FieldContent>
						<FieldTitle>{title}</FieldTitle>
						<FieldDescription>{description}</FieldDescription>
					</FieldContent>
					<Checkbox checked={enabled} onClick={onToggle} />
				</Field>
			</FieldLabel>
		</Box>
	);
}
