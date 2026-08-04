import bcrypt from "bcrypt";

// Bcrypt cost factor. Matches the value passlib uses on the Python side. The
// `$2b$12$...` hashes already present in the shared `users` table were
// generated with this cost, and any new hashes we write must keep it.
const COST = 12;

export async function hashPassword(plain: string): Promise<Buffer> {
	return Buffer.from(await bcrypt.hash(plain, COST), "utf8");
}

export async function verifyPassword(
	plain: string,
	hash: Buffer,
): Promise<boolean> {
	return bcrypt.compare(plain, hash.toString("utf8"));
}
