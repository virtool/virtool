import { cn } from "@app/cn";
import { bannerColorClasses } from "@banner/types";
import { type BannerColor, bannerColors } from "@virtool/contracts";

const labels: Record<BannerColor, string> = {
	red: "Red",
	orange: "Orange",
	yellow: "Yellow",
	blue: "Blue",
	purple: "Purple",
	grey: "Grey",
};

type BannerColorPickerProps = {
	id?: string;
	name?: string;
	value: BannerColor;
	onChange: (value: BannerColor) => void;
	"aria-labelledby"?: string;
};

/**
 * Radio group for picking a banner color. Renders the `bannerColors` palette
 * as colored circles.
 */
export default function BannerColorPicker({
	id,
	name = "banner-color",
	value,
	onChange,
	"aria-labelledby": ariaLabelledBy,
}: BannerColorPickerProps) {
	return (
		<fieldset
			id={id}
			aria-labelledby={ariaLabelledBy}
			className="flex gap-2 mt-1 border-0 p-0"
		>
			{bannerColors.map((color) => (
				<label
					key={color}
					className={cn(
						bannerColorClasses[color],
						"h-8",
						"w-8",
						"rounded-full",
						"cursor-pointer",
						"ring-offset-2",
						"focus-within:ring-2",
						"focus-within:ring-blue-500",
						value === color && "ring-2 ring-gray-900",
					)}
				>
					<input
						type="radio"
						name={name}
						value={color}
						checked={value === color}
						onChange={() => onChange(color)}
						aria-label={labels[color]}
						className="sr-only"
					/>
				</label>
			))}
		</fieldset>
	);
}
