import { endSession } from "@app/session";
import Superagent, { type Request, type Response } from "superagent";

const agent = Superagent.agent();

function prefixRequestUrl(request: Request) {
	if (request.url[0] !== "/") {
		request.url = `/${request.url}`;
	}

	if (!request.url.startsWith("/api")) {
		request.url = `/api${request.url}`;
	}

	return request;
}

function handleUnauthorized(request: Request) {
	// Superagent emits `response` for every parsed response before it decides
	// whether the status was a failure, so a 401 is visible here.
	request.on("response", (response: Response) => {
		if (response.status === 401) {
			endSession();
		}
	});

	return request;
}

agent.accept("application/json");
agent.use(prefixRequestUrl);
agent.use(handleUnauthorized);

export const apiClient = agent;
