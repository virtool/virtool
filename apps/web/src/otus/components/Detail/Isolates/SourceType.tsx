import { InputGroup, InputLabel, InputSimple } from "@base/Input";
import Select, { SelectButton, SelectContent, SelectItem } from "@base/Select";
import { capitalize } from "es-toolkit";
import { ChevronDown } from "lucide-react";
import { type Control, Controller } from "react-hook-form";

type IsolateFormValues = {
	sourceName: string;
	sourceType: string;
};

type SourceTypeProps = {
	allowedSourceTypes: string[];
	/** Controls the form field */
	control: Control<IsolateFormValues>;
	/** Indicates whether the source types are restricted */
	restrictSourceTypes: boolean;
};

/**
 * Displays input for source type in isolate creation dialog
 */
export function SourceType({
	allowedSourceTypes,
	control,
	restrictSourceTypes,
}: SourceTypeProps) {
	if (restrictSourceTypes) {
		return (
			<InputGroup>
				<InputLabel htmlFor="sourceType">Source Type</InputLabel>
				<Controller
					name="sourceType"
					control={control}
					render={({ field: { onChange, value } }) => (
						<Select value={value} onValueChange={onChange}>
							<SelectButton
								className="w-full"
								icon={ChevronDown}
								id="sourceType"
							/>
							<SelectContent>
								<SelectItem key="default" value="unknown">
									Unknown
								</SelectItem>
								{allowedSourceTypes.map((sourceType) => (
									<SelectItem key={sourceType} value={capitalize(sourceType)}>
										{capitalize(sourceType)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				/>
			</InputGroup>
		);
	}

	return (
		<InputGroup>
			<InputLabel htmlFor="sourceType">Source Type</InputLabel>
			<Controller
				name="sourceType"
				control={control}
				render={({ field: { onChange, value } }) => (
					<InputSimple
						id="sourceType"
						onChange={onChange}
						value={capitalize(value)}
					/>
				)}
			/>
		</InputGroup>
	);
}
