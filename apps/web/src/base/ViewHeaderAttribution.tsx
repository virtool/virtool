import { cn } from "@app/cn";
import Attribution from "./Attribution";

type ViewHeaderAttributionProps = {
	className?: string;
	time: Date | null;
	user?: string;
	verb?: string;
};

export default function ViewHeaderAttribution({
	className,
	...rest
}: ViewHeaderAttributionProps) {
	return <Attribution className={cn("text-sm mt-1", className)} {...rest} />;
}
