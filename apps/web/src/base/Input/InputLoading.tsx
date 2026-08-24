import Loader from "@base/Loader";
import InputIcon from "./InputIcon";

export default function InputLoading() {
	return (
		<InputIcon>
			<Loader className="size-4" />
		</InputIcon>
	);
}
