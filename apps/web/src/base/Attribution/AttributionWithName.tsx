import { InitialIcon } from "@base/Icon";
import { capitalize } from "es-toolkit";

type AttributionWithNameProps = {
	className?: string;
	user: string;
	verb?: string;
};

export default function AttributionWithName({
	className = "",
	user,
	verb = "created",
}: AttributionWithNameProps) {
	return (
		<span className={`inline-flex items-center ${className}`}>
			{capitalize(verb)} by{" "}
			{user ? (
				<InitialIcon size="md" handle={user} className="mr-0.5 ml-1.5" />
			) : null}{" "}
			{user}
		</span>
	);
}
