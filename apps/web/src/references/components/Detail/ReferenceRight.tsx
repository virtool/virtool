import Checkbox from "@base/Checkbox";
import type { ReferenceRights } from "@virtool/contracts";

const descriptions: Record<keyof ReferenceRights, string> = {
	build: "Can build new indexes for the reference.",
	modify: "Can modify reference properties and settings.",
	modifyOtu: "Can modify OTU records in the reference.",
};

type MemberRightProps = {
	/** The name of the right */
	right: keyof ReferenceRights;
	/** Indicates whether the right is currently enabled */
	enabled: boolean;
	/** A callback function to toggle the enabled state of the right */
	onToggle: (right: keyof ReferenceRights, enabled: boolean) => void;
};

/**
 * Displays the rights for the group/user with options to modify the rights
 */
export function ReferenceRight({ right, enabled, onToggle }: MemberRightProps) {
	return (
		<div className="flex items-start not-last:mb-4">
			<div className="mt-px">
				<Checkbox
					checked={enabled}
					id={`ReferenceRightCheckbox-${right}`}
					key={right}
					onClick={() => onToggle(right, !enabled)}
				/>
			</div>
			<div className="flex flex-col pl-2.5">
				<strong>{right}</strong>
				<small className="pt-0.5">{descriptions[right]}</small>
			</div>
		</div>
	);
}
