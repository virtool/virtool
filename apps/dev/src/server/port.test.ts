import { createServer } from "node:net";
import { afterEach, expect, it } from "vitest";
import { checkPortAvailable } from "./port.ts";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(() => {
	for (const server of servers.splice(0)) {
		server.close();
	}
});

it("detects an occupied port", async () => {
	const server = createServer().listen(0, "127.0.0.1");
	servers.push(server);
	await new Promise((resolve) => server.once("listening", resolve));
	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("Expected TCP address");
	}
	await expect(checkPortAvailable(address.port)).rejects.toThrow(/occupied/);
});
