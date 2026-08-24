import Input, { InputContainer, InputIconButton } from "@base/Input";
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
			<InputContainer align="right" className="flex align-items-center">
				<Input
					value={value}
					placeholder={placeholder}
					aria-label={label}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
						onChange(e.target.value)
					}
					autoFocus={autoFocus}
				/>
				<InputIconButton
					className="flex justify-center justify-items-center absolute"
					IconComponent={X}
					tip="Clear"
					color="gray"
					onClick={() => onChange("")}
					aria-label="clear"
				/>
			</InputContainer>
		</BoxGroupSection>
	);
}
