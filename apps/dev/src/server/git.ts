import { realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { OpenPullRequest } from "../shared/types.ts";
import type { CommandRunner } from "./command.ts";

/** Paths that identify a Git repository and its primary checkout. */
export type RepositoryPaths = {
	commonDirectory: string;
	primaryWorktree: string;
	stateDirectory: string;
};

/** A discovered Git worktree with its durable administrative identity. */
export type GitWorktree = {
	branch: string;
	id: string;
	path: string;
};

type PullRequestResult = OpenPullRequest & { headRefName: string };

function absoluteGitPath(cwd: string, path: string): string {
	return isAbsolute(path) ? path : resolve(cwd, path);
}

export async function resolveRepository(
	run: CommandRunner,
	cwd: string,
): Promise<RepositoryPaths> {
	const [{ stdout: commonOutput }, { stdout: worktrees }] = await Promise.all([
		run("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
			cwd,
		}),
		run("git", ["worktree", "list", "--porcelain"], { cwd }),
	]);
	const commonDirectory = await realpath(commonOutput.trim());
	const primaryLine = worktrees
		.split("\n")
		.find((line) => line.startsWith("worktree "));
	if (!primaryLine) {
		throw new Error("Git did not report a primary worktree");
	}
	return {
		commonDirectory,
		primaryWorktree: primaryLine.slice("worktree ".length),
		stateDirectory: join(commonDirectory, "virtool-dev"),
	};
}

export async function discoverWorktrees(
	run: CommandRunner,
	primaryWorktree: string,
): Promise<GitWorktree[]> {
	const { stdout } = await run(
		"git",
		["worktree", "list", "--porcelain", "-z"],
		{
			cwd: primaryWorktree,
		},
	);
	const records = stdout.split("\0\0").filter(Boolean);
	return Promise.all(
		records.map(async (record) => {
			const fields = new Map(
				record
					.split("\0")
					.filter(Boolean)
					.map((line) => {
						const separator = line.indexOf(" ");
						return separator === -1
							? [line, ""]
							: [line.slice(0, separator), line.slice(separator + 1)];
					}),
			);
			const path = fields.get("worktree");
			if (!path || fields.has("prunable")) {
				return null;
			}
			const { stdout: gitDirectory } = await run(
				"git",
				["rev-parse", "--path-format=absolute", "--git-dir"],
				{ cwd: path },
			);
			return {
				branch: (fields.get("branch") ?? "detached").replace(
					/^refs\/heads\//,
					"",
				),
				id: absoluteGitPath(path, gitDirectory.trim()),
				path,
			};
		}),
	).then((worktrees) =>
		worktrees.filter((worktree): worktree is GitWorktree => worktree !== null),
	);
}

/** Return open GitHub pull requests keyed by their source branch. */
export async function getOpenPullRequests(
	run: CommandRunner,
	cwd: string,
): Promise<Map<string, OpenPullRequest>> {
	try {
		const { stdout } = await run(
			"gh",
			[
				"pr",
				"list",
				"--state",
				"open",
				"--json",
				"headRefName,url,number",
				"--limit",
				"1000",
			],
			{ cwd },
		);
		const pullRequests = JSON.parse(stdout) as PullRequestResult[];
		return new Map(
			pullRequests.map(({ headRefName, number, url }) => [
				headRefName,
				{ number, url },
			]),
		);
	} catch {
		return new Map();
	}
}
