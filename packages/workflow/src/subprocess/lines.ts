import type { LineHandler } from "./types";

const NEWLINE = 0x0a;
const CARRIAGE_RETURN = 0x0d;

/** Feeds raw chunks in and gets whole lines out. */
export type LineSplitter = {
	/** Hand the splitter one chunk. Resolves once its handler has. */
	push: (chunk: Buffer) => Promise<void>;
	/** Emit whatever is left over, for a final line with no trailing newline. */
	flush: () => Promise<void>;
};

/** Options for {@link createLineSplitter}. */
export type CreateLineSplitterOptions = {
	onLine: LineHandler;
	/** Largest line, in bytes. */
	maxLineBytes: number;
	/** Builds the error thrown when a line exceeds `maxLineBytes`. */
	createLimitError: () => Error;
};

/**
 * Split a byte stream into lines, refusing to buffer one past a byte ceiling.
 *
 * `node:readline` would do the splitting, but it has no length ceiling at all:
 * a tool that writes a gigabyte with no newline in it grows this process'
 * heap until it dies, and the failure names the workflow rather than the tool.
 *
 * Splitting on the newline byte is safe without decoding first, because every
 * byte of a multi-byte UTF-8 sequence has its high bit set and so can never be
 * `0x0a`. Each line is then decoded on its own, with invalid sequences
 * replaced by U+FFFD — Python uses `backslashreplace`, but nothing reads these
 * lines back as bytes and the replacement character is what every other string
 * in this codebase does with undecodable input.
 */
export function createLineSplitter({
	onLine,
	maxLineBytes,
	createLimitError,
}: CreateLineSplitterOptions): LineSplitter {
	let pending: Buffer[] = [];
	let pendingBytes = 0;

	function guard(incoming: number): void {
		if (pendingBytes + incoming > maxLineBytes) {
			throw createLimitError();
		}
	}

	async function emit(tail: Buffer): Promise<void> {
		const line = pendingBytes === 0 ? tail : Buffer.concat([...pending, tail]);

		pending = [];
		pendingBytes = 0;

		await onLine(decode(line));
	}

	return {
		async push(chunk) {
			let start = 0;

			for (;;) {
				const index = chunk.indexOf(NEWLINE, start);

				if (index === -1) {
					break;
				}

				const slice = chunk.subarray(start, index);

				guard(slice.length);
				await emit(slice);

				start = index + 1;
			}

			const rest = chunk.subarray(start);

			if (rest.length > 0) {
				guard(rest.length);

				pending.push(rest);
				pendingBytes += rest.length;
			}
		},
		async flush() {
			if (pendingBytes > 0) {
				await emit(Buffer.alloc(0));
			}
		},
	};
}

/**
 * Decode one line, dropping the carriage return a CRLF stream leaves behind.
 *
 * Only the newline is stripped. Python's `rstrip()` takes every trailing
 * whitespace character with it, which would silently reflow the aligned
 * columns a tool writes to stderr.
 */
function decode(line: Buffer): string {
	const end =
		line.length > 0 && line[line.length - 1] === CARRIAGE_RETURN
			? line.length - 1
			: line.length;

	return line.toString("utf8", 0, end);
}
