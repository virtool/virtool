import { expect, it } from "vitest";
import { BuildCoordinator } from "./builds.ts";

it("runs one build at a time and prioritizes queued core work", async () => {
	const builds = new BuildCoordinator();
	const order: string[] = [];
	let release: (() => void) | undefined;
	const first = builds.run("workflow", async () => {
		order.push("active workflow");
		await new Promise<void>((resolve) => {
			release = resolve;
		});
	});
	const second = builds.run("workflow", async () => {
		order.push("queued workflow");
	});
	const core = builds.run("core", async () => {
		order.push("core");
	});
	release?.();
	await Promise.all([first, second, core]);
	expect(order).toEqual(["active workflow", "core", "queued workflow"]);
});
