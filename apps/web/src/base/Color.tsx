import { cn } from "@app/cn";
import Input from "@base/Input";

type PresetColor = {
	// The color in hex format, without a leading "#"
	hex: string;
	// The accessible name announced for the swatch
	name: string;
};

const presetColors: PresetColor[] = [
	// Grey
	{ hex: "D1D5DB", name: "Light grey" },
	{ hex: "6B7280", name: "Grey" },
	{ hex: "374151", name: "Dark grey" },

	// Red
	{ hex: "FCA5A5", name: "Light red" },
	{ hex: "EF4444", name: "Red" },
	{ hex: "B91C1C", name: "Dark red" },

	// Yellow
	{ hex: "FCD34D", name: "Light yellow" },
	{ hex: "F59E0B", name: "Yellow" },
	{ hex: "B45309", name: "Dark yellow" },

	// Green
	{ hex: "6EE7B7", name: "Light green" },
	{ hex: "10B981", name: "Green" },
	{ hex: "047857", name: "Dark green" },

	// Blue
	{ hex: "93C5FD", name: "Light blue" },
	{ hex: "3B82F6", name: "Blue" },
	{ hex: "1D4ED8", name: "Dark blue" },

	// Indigo
	{ hex: "A5B4FC", name: "Light indigo" },
	{ hex: "6366F1", name: "Indigo" },
	{ hex: "4338CA", name: "Dark indigo" },

	// Purple
	{ hex: "C4B5FD", name: "Light purple" },
	{ hex: "8B5CF6", name: "Purple" },
	{ hex: "5B21B6", name: "Dark purple" },

	// Pink
	{ hex: "FBCFE8", name: "Light pink" },
	{ hex: "F472B6", name: "Pink" },
	{ hex: "EC4899", name: "Dark pink" },
];

type ColorSwatchProps = {
	// The color in hex format, with a leading "#"
	color: string;
	// The name of the radio group this swatch belongs to
	group: string;
	// The accessible name announced for the swatch
	name: string;
	// Whether this swatch matches the current value
	checked: boolean;
	// The callback to be called when the swatch is selected
	onChange: (color: string) => void;
};

/**
 * A radio swatch that selects its color when chosen
 */
function ColorSwatch({
	color,
	group,
	name,
	checked,
	onChange,
}: ColorSwatchProps) {
	return (
		<label
			className={cn(
				"flex-1",
				"h-full",
				"cursor-pointer",
				"transition-transform",
				"hover:-translate-y-0.5",
				"ring-offset-2",
				"ring-offset-gray-300",
				"focus-within:ring-2",
				"focus-within:ring-white",
				"focus-within:z-10",
				"first:rounded-l-sm",
				"last:rounded-r-sm",
				checked && "ring-2 ring-gray-900 z-10",
			)}
			style={{ backgroundColor: color }}
		>
			<input
				type="radio"
				name={group}
				value={color}
				checked={checked}
				onChange={() => onChange(color)}
				aria-label={name}
				className="sr-only"
			/>
		</label>
	);
}

type ColorProps = {
	// The id of the input
	id: string;
	// The value of the input (color in hex format)
	value: string;
	// The callback to be called when the value changes
	onChange: (value: string) => void;
};

/**
 * A color text input with an accessible swatch picker below it
 */
export default function Color({ id, value, onChange }: ColorProps) {
	return (
		<div>
			<Input
				id={id}
				value={value}
				onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
					onChange(e.target.value)
				}
			/>
			<fieldset
				aria-label="Preset colors"
				className={cn("flex", "h-9", "mt-2.5", "border-0", "p-0")}
			>
				{presetColors.map(({ hex, name }) => {
					const color = `#${hex}`;

					return (
						<ColorSwatch
							key={hex}
							color={color}
							group={`${id}-swatch`}
							name={name}
							checked={value.toLowerCase() === color.toLowerCase()}
							onChange={onChange}
						/>
					);
				})}
			</fieldset>
		</div>
	);
}
