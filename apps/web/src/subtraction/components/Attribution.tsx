import Attribution, { AttributionWithName } from "@base/Attribution";
import type { ReactElement } from "react";

type SubtractionAttributionProps = {
	/* The user username */
	username: string;
	/* The time of the subtraction */
	time?: Date | null;
};

/**
 * Formatted attribution showing creating user's username and time of creation
 */
export function SubtractionAttribution({
	username,
	time,
}: SubtractionAttributionProps): ReactElement {
	if (username) {
		if (time) {
			return <Attribution user={username} time={time} />;
		}
		return <AttributionWithName user={username} />;
	}
	return (
		<div className="top-1/2 min-h-5 text-xs italic text-gray-500">
			Creator and timestamp unavailable
		</div>
	);
}
