/**
 * Reading one named member out of a zip archive held in memory.
 *
 * The tar side of this package streams archives that can run to gigabytes.
 * This reader uses `unzipSync` and needs the complete archive in memory. Its
 * current input, an NCBI BLAST result zip, is only a few kilobytes. Do not use
 * it to unpack large uploads.
 */

import { unzipSync } from "fflate";
import { ZipArchiveError, ZipMemberMissingError } from "./errors";

/**
 * Read one member out of a zip archive by name.
 *
 * Throws `ZipMemberMissingError` when the archive is well-formed but carries no
 * such member, and `ZipArchiveError` when it could not be read at all. The two
 * are worth telling apart: the first is a layout contract that has changed,
 * the second is bytes that are not a zip.
 */
export function readZipMember(data: Uint8Array, name: string): Uint8Array {
	let members: Record<string, Uint8Array>;

	try {
		members = unzipSync(data, { filter: (file) => file.name === name });
	} catch (err) {
		throw new ZipArchiveError("could not read zip archive", { cause: err });
	}

	const member = members[name];

	if (member === undefined) {
		throw new ZipMemberMissingError(name);
	}

	return member;
}
