import Dashboard from "@dashboard/components/Dashboard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
	component: Dashboard,
});
