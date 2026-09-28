import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import Input, { type InputProps } from "./Input";
import InputContainer from "./InputContainer";
import InputIconButton from "./InputIconButton";

type InputPasswordProps = Omit<InputProps, "type"> & {
	id: string;
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
		<InputContainer className="flex flex-grow-1">
			<Input {...props} type={show ? "text" : "password"} />
			<InputIconButton
				tip={show ? "Hide" : "Show"}
				IconComponent={show ? Eye : EyeOff}
				onClick={() => setShow((prevShow) => !prevShow)}
			/>
		</InputContainer>
	);
}
