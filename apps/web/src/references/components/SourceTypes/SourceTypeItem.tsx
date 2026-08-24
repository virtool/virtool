import BoxGroupSection from "@base/BoxGroupSection";
import IconButton from "@base/IconButton";
import { Trash } from "lucide-react";

type SourceTypeItemProps = {
	disabled?: boolean;
	sourceType: string;
	onRemove: (sourceType: string) => void;
};

export function SourceTypeItem({
	onRemove,
	sourceType,
	disabled = false,
}: SourceTypeItemProps) {
	return (
		<BoxGroupSection className="flex items-center capitalize">
			<span className="mr-1.5">{sourceType}</span>
			{disabled ? null : (
				<IconButton
					className="ml-auto"
					IconComponent={Trash}
					color="red"
					tip="Remove"
					onClick={() => onRemove(sourceType)}
				/>
			)}
		</BoxGroupSection>
	);
}
