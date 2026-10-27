import { createServer } from "node:net";

export async function checkPortAvailable(port: number): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const server = createServer();
		server.once("error", () =>
			reject(new Error(`Port ${port} is already occupied`)),
		);
		server.listen(port, "127.0.0.1", () => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	});
}
