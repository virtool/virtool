import { Search } from "lucide-react";
import Input, { type InputProps } from "./Input";
import InputContainer from "./InputContainer";
import InputIcon from "./InputIcon";

/** Props for the search input. Requires an `aria-label` so screen readers announce an accessible name. */
export type InputSearchProps = InputProps & {
	/** Accessible name for the search input, announced by assistive technology. */
	"aria-label": string;
};

export default function InputSearch(props: InputSearchProps) {
	return (
		<InputContainer align="left" className="flex-grow">
			<Input {...props} />
			<InputIcon icon={Search} />
		</InputContainer>
	);
}
