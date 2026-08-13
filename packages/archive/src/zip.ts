/**
 * Reading one named member out of a zip archive held in memory.
 *
 * The tar side of this package streams, because the archives it moves are
 * caches and reference builds that run to gigabytes. Zip cannot: its index is a
 * central directory written at the *end* of the file, so nothing can name a
 * member until the whole archive has arrived. That is acceptable only because
 * the one thing here that reads a zip — an NCBI BLAST result — is a handful of
 * kilobytes. Do not reach for this to unpack anything a user uploaded.
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
