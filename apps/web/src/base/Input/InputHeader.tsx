import { objectHasProperty } from "@app/common";
import { type MutableRefObject, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";

type InputHeaderProps = {
	id: string;
	value?: string;
	onSubmit: (value: string) => void;
};

/**
 * A styled input header field that handles form submission
 */
export default function InputHeader({
	id,
	value = "",
	onSubmit,
}: InputHeaderProps) {
	const inputElement = useRef<HTMLInputElement>(null);

	const {
		formState: { isSubmitting },
		handleSubmit,
		setValue,
		watch,
	} = useForm({
		defaultValues: { [id]: value },
	});

	function onFormSubmit(data: Record<string, string>) {
		onSubmit(data[id] ?? "");

		if (
			inputElement.current &&
			objectHasProperty(inputElement.current, "blur")
		) {
			inputElement.current.blur();
		}
	}

	useEffect(() => {
		setValue(id, value);
	}, [value, id, setValue]);

	return (
		<form
			className="border-2 border-transparent rounded-md mb-4 box-border focus-within:bg-gray-50 focus-within:border-blue-600 [&:focus-within>input]:translate-x-4"
			onSubmit={handleSubmit(onFormSubmit)}
		>
			<input
				aria-label={id}
				autoComplete="off"
				className="bg-transparent border-none text-2xl font-bold outline-none py-2.5 px-0 w-full transition-transform"
				id={id}
				name={id}
				ref={inputElement as MutableRefObject<HTMLInputElement>}
				value={watch(id)}
				onBlur={() => {
					if (!isSubmitting) {
						handleSubmit(onFormSubmit)();
					}
				}}
				onChange={(e) => {
					setValue(id, e.target.value);
				}}
			/>
		</form>
	);
}
