import Attribution from "@base/Attribution";
import AttributionWithName from "@base/AttributionWithName";
import type { ReactElement } from "react";

type SubtractionAttributionProps = {
	/* The user handle */
	handle: string;
	/* The time of the subtraction */
	time?: Date | null;
};

/**
 * Formatted attribution showing creating user's handle and time of creation
 */
export function SubtractionAttribution({
	handle,
	time,
}: SubtractionAttributionProps): ReactElement {
	if (handle) {
		if (time) {
			return <Attribution user={handle} time={time} />;
		}
		return <AttributionWithName user={handle} />;
	}
	return (
		<div className="top-1/2 min-h-5 text-xs italic text-gray-500">
			Creator and timestamp unavailable
		</div>
	);
}
