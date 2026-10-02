import { cn } from "@app/cn";
import { bannerColorClasses } from "@banner/types";
import { BoxGroupSection } from "@base/Box";
import Field, { FieldLabel } from "@base/Field";
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
	return (
		<BoxGroupSection className="flex items-center gap-3">
			<Field className="min-w-0 grow" orientation="horizontal">
				<RadioGroupItem value={id.toString()} />
				<FieldLabel className="flex min-w-0 grow cursor-pointer items-center gap-3 font-normal">
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
				</FieldLabel>
			</Field>
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
