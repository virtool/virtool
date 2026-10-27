import { handleAvatar } from "@server/users/avatar";
import { createFileRoute } from "@tanstack/react-router";

// A raw route, not a server function: the client loads this with an `<img>`.
export const Route = createFileRoute("/avatars/$handle")({
	server: {
		handlers: {
			GET: ({ request, params }) => handleAvatar(request, params.handle),
		},
	},
});
