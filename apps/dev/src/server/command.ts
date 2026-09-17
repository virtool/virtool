import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Result from an external command. */
export type CommandResult = {
	stderr: string;
	stdout: string;
};

/** Boundary for invoking installed Git, Docker, Compose, and Worktrunk CLIs. */
export type CommandRunner = (
	command: string,
	args: string[],
	options?: { cwd?: string; env?: NodeJS.ProcessEnv },
) => Promise<CommandResult>;

/** Run an external command without involving a shell. */
export async function runCommand(
	command: string,
	args: string[],
	options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<CommandResult> {
	const result = await execFileAsync(command, args, {
		cwd: options.cwd,
		env: options.env,
		maxBuffer: 16 * 1024 * 1024,
	});
	return { stderr: result.stderr, stdout: result.stdout };
}
