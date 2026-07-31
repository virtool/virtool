import type { JobState } from "@virtool/contracts";
import { Ban, CircleCheck, Clock, Play, TriangleAlert } from "lucide-react";

type JobStateIconProps = {
	state: JobState;
};

export default function JobStateIcon({ state }: JobStateIconProps) {
	const size = 16;

	switch (state) {
		case "succeeded":
			return <CircleCheck className="stroke-green-600" size={size} />;
		case "pending":
			return <Clock className="stroke-purple-600" size={size} />;
		case "running":
			return <Play className="stroke-green-600" size={size} />;
		case "cancelled":
			return <Ban className="stroke-orange-600" size={size} />;
		case "failed":
			return <TriangleAlert className="stroke-red-600" size={size} />;
	}
}
