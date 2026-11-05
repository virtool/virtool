import { createKeyring } from "../keyring";

/** A keyring with a fixed active key, for tests that only need encryption to work. */
export const keyring = createKeyring(
	Buffer.alloc(32, 1).toString("base64"),
	undefined,
);
