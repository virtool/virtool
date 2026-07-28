import Attribution from "@base/Attribution";
import BoxGroupSection from "@base/BoxGroupSection";
import Icon, { type IconProps } from "@base/Icon";
import Label from "@base/Label";
import type {
	HistoryMethod,
	HistoryOtuNested,
	UserNested,
} from "@virtool/contracts";
import {
	AlertTriangle,
	ArrowUpCircle,
	Copy,
	Dna,
	FileUp,
	FlaskConical,
	Link,
	Pencil,
	PlusSquare,
	Star,
	Trash,
} from "lucide-react";

const methodIconProps: Record<HistoryMethod, IconProps> = {
	add_isolate: {
		icon: FlaskConical,
		color: "blue",
	},
	create: {
		icon: PlusSquare,
		color: "blue",
	},
	create_sequence: {
		icon: Dna,
		color: "blue",
	},
	edit: {
		icon: Pencil,
		color: "orange",
	},
	edit_isolate: {
		icon: FlaskConical,
		color: "orange",
	},
	edit_sequence: {
		icon: Dna,
		color: "orange",
	},
	clone: {
		icon: Copy,
		color: "blue",
	},
	import: {
		icon: FileUp,
		color: "blue",
	},
	remote: {
		icon: Link,
		color: "blue",
	},
	remove: {
		icon: Trash,
		color: "red",
	},
	remove_isolate: {
		icon: FlaskConical,
		color: "red",
	},
	remove_sequence: {
		icon: Dna,
		color: "red",
	},
	set_as_default: {
		icon: Star,
		color: "orange",
	},
	update: {
		icon: ArrowUpCircle,
		color: "orange",
	},
};

function getMethodIcon(methodName: string) {
	const props = methodIconProps[methodName as keyof typeof methodIconProps] ?? {
		icon: AlertTriangle,
		color: "red",
	};

	return <Icon {...props} />;
}

type ChangeProps = {
	createdAt: Date;
	description: string;
	methodName: string;
	otu: HistoryOtuNested;
	user: UserNested;
};

/**
 * A condensed change item for use in a list of changes
 */
export default function Change({
	createdAt,
	description,
	methodName,
	otu,
	user,
}: ChangeProps) {
	return (
		<BoxGroupSection className="grid grid-cols-[42px_2fr_1fr] items-center">
			<div>
				<Label>{otu.version}</Label>
			</div>

			<div className="flex items-center gap-2">
				{getMethodIcon(methodName)}
				<span>{description || "No Description"}</span>
			</div>

			<Attribution time={createdAt} user={user.handle} verb="" />
		</BoxGroupSection>
	);
}
