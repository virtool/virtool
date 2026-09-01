import Alert from "@base/Alert";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/refs/alpha")({
	component: ReferencesV2Layout,
});

function ReferencesV2Layout() {
	return (
		<>
			<Alert
				color="orange"
				icon={TriangleAlert}
				level
				className="p-3 text-sm"
				outerClassName="border border-amber-200 bg-amber-50 text-amber-700 shadow-none"
			>
				Alpha - References v2 is in testing and not ready for use.
			</Alert>
			<Outlet />
		</>
	);
}
