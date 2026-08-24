import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import Input, { type InputProps } from "./Input";
import InputContainer from "./InputContainer";
import InputIconButton from "./InputIconButton";

type InputPasswordProps = Omit<InputProps, "type"> & {
	id: string;
	name: string;
};

export default function InputPassword(props: InputPasswordProps) {
	const [show, setShow] = useState(false);

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
