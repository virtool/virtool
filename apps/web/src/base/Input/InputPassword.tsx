import InputGroup, {
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@base/InputGroup";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import Input, { type InputProps } from "./Input";

type InputPasswordProps = Omit<InputProps, "type"> & {
	name: string;
	showVisibilityToggle?: boolean;
};

export default function InputPassword({
	showVisibilityToggle = true,
	...props
}: InputPasswordProps) {
	const [show, setShow] = useState(false);

	if (!showVisibilityToggle) {
		return <Input {...props} type="password" />;
	}

	return (
		<InputGroup>
			<InputGroupInput {...props} type={show ? "text" : "password"} />
			<InputGroupAddon align="inline-end">
				<InputGroupButton
					tip={show ? "Hide" : "Show"}
					IconComponent={show ? Eye : EyeOff}
					onClick={() => setShow((prevShow) => !prevShow)}
				/>
			</InputGroupAddon>
		</InputGroup>
	);
}
