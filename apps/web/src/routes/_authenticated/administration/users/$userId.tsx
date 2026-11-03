import { createFileRoute } from "@tanstack/react-router";
import UserDetail from "@users/components/UserDetail";

export const Route = createFileRoute(
	"/_authenticated/administration/users/$userId",
)({
	loader: async ({ context: { queryClient }, params: { userId } }) => {
		const { userQueryOptions } = await import("@users/queries");
		return queryClient.ensureQueryData(userQueryOptions(Number(userId)));
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { userId } = Route.useParams();
	return <UserDetail userId={Number(userId)} />;
}
