import { expect, it, vi } from "vitest";
import type { CommandRunner } from "./command.ts";
import { discoverWorktrees, getOpenPullRequests } from "./git.ts";

it("parses all null-delimited worktrees and ignores prunable entries", async () => {
	const run = vi.fn<CommandRunner>(async (_command, args, options) => {
		if (args.includes("list")) {
			return {
				stderr: "",
				stdout:
					"worktree /one\0HEAD abc\0branch refs/heads/main\0\0worktree /gone\0prunable reason\0\0worktree /two\0HEAD def\0detached\0\0",
			};
		}
		return { stderr: "", stdout: `${options?.cwd}/.git\n` };
	});
	const worktrees = await discoverWorktrees(run, "/one");
	expect(worktrees).toEqual([
		{ branch: "main", id: "/one/.git", path: "/one" },
		{ branch: "detached", id: "/two/.git", path: "/two" },
	]);
});

it("reads open pull requests by source branch", async () => {
	const run = vi.fn<CommandRunner>(async () => ({
		stderr: "",
		stdout: JSON.stringify([
			{
				headRefName: "feature/one",
				number: 42,
				url: "https://github.com/pr/42",
			},
		]),
	}));

	await expect(getOpenPullRequests(run, "/repo")).resolves.toEqual(
		new Map([["feature/one", { number: 42, url: "https://github.com/pr/42" }]]),
	);
});

it("ignores unavailable GitHub CLI access", async () => {
	const run = vi.fn<CommandRunner>(async () => {
		throw new Error("not authenticated");
	});

	await expect(getOpenPullRequests(run, "/repo")).resolves.toEqual(new Map());
});
