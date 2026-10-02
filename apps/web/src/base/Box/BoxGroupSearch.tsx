import InputGroup, {
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@base/InputGroup";
import { X } from "lucide-react";
import BoxGroupSection from "./BoxGroupSection";

type BoxGroupSearchProps = {
	label: string;
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
	autoFocus?: boolean;
};

export default function BoxGroupSearch({
	label,
	placeholder = "",
	value,
	onChange,
	autoFocus = false,
}: BoxGroupSearchProps) {
	return (
		<BoxGroupSection>
			<InputGroup>
				<InputGroupInput
					value={value}
					placeholder={placeholder}
					aria-label={label}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
						onChange(e.target.value)
					}
					autoFocus={autoFocus}
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						IconComponent={X}
						tip="Clear"
						color="gray"
						onClick={() => onChange("")}
						aria-label="clear"
					/>
				</InputGroupAddon>
			</InputGroup>
		</BoxGroupSection>
	);
}
