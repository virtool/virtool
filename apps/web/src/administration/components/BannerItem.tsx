import { cn } from "@app/cn";
import { bannerColorClasses } from "@banner/types";
import BoxGroupSection from "@base/BoxGroupSection";
import { RadioGroupItem } from "@base/RadioGroup";
import type { BannerColor } from "@virtool/contracts";
import type { BannerFormValues } from "./BannerForm";
import DeleteBanner from "./DeleteBanner";
import EditBanner from "./EditBanner";

type BannerItemProps = {
	color: BannerColor;
	id: number;
	message: string;
	onEdit: (id: number, values: BannerFormValues) => Promise<unknown>;
	onRemove: (id: number) => Promise<unknown>;
};

/**
 * A single banner row rendered as a radio option, paired with edit and delete
 * affordances.
 */
export default function BannerItem({
	color,
	id,
	message,
	onEdit,
	onRemove,
}: BannerItemProps) {
	const radioId = `banner-${id}`;

	return (
		<BoxGroupSection className="flex items-center gap-3">
			<RadioGroupItem id={radioId} value={id.toString()} />
			<label
				htmlFor={radioId}
				className="flex grow items-center gap-3 min-w-0 cursor-pointer"
			>
				<span
					className={cn(
						bannerColorClasses[color],
						"h-5",
						"w-5",
						"shrink-0",
						"rounded-full",
					)}
					aria-hidden="true"
				/>
				<span className="grow truncate">{message}</span>
			</label>
			<div className="flex items-center gap-1">
				<EditBanner
					color={color}
					message={message}
					onSubmit={(values) => onEdit(id, values)}
				/>
				<DeleteBanner message={message} onConfirm={() => onRemove(id)} />
			</div>
		</BoxGroupSection>
	);
}
