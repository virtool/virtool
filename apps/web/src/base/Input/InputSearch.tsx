import InputGroup, {
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@base/InputGroup";
import { Search } from "lucide-react";
import type { InputProps } from "./Input";

/** Props for the search input. Requires an `aria-label` so screen readers announce an accessible name. */
export type InputSearchProps = InputProps & {
	/** Accessible name for the search input, announced by assistive technology. */
	"aria-label": string;
};

export default function InputSearch(props: InputSearchProps) {
	return (
		<InputGroup className="flex-grow">
			<InputGroupInput {...props} />
			<InputGroupAddon>
				<InputGroupText>
					<Search aria-hidden />
				</InputGroupText>
			</InputGroupAddon>
		</InputGroup>
	);
}
