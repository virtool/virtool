import type { Db } from "@virtool/data/db/pg";
import { legacyOtus, legacySequences } from "@virtool/data/db/schema/otus";
import { legacyReferences } from "@virtool/data/db/schema/references";
import { sessions } from "@virtool/data/db/schema/sessions";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest: vi.fn(),
	setCookie: vi.fn(),
	setResponseStatus: vi.fn(),
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
}));

let db: Db;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
}));

const { handleIsolateFasta, handleOtuFasta, handleSequenceFasta } =
	await import("./fasta");
const { seedSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { seedReference } = await import("@virtool/data/indexes/test/fixtures");
const { sessionCookie } = await import("../auth/test/fixtures");

let database: TestDatabase;
let cookie: string;
let referenceId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	vi.clearAllMocks();
	await db.delete(legacySequences);
	await db.delete(legacyOtus);
	await db.delete(legacyReferences);
	await db.delete(sessions);
	await db.delete(users);

	const userId = await seedUser(db);
	const { sessionId, token } = await seedSession(db, userId);

	cookie = sessionCookie({ sessionId, token });
	referenceId = await seedReference(db, userId);
});

function signedIn(): Request {
	return new Request("https://virtool.test/otus/otu/fasta", {
		headers: { cookie },
	});
}

function anonymous(): Request {
	return new Request("https://virtool.test/otus/otu/fasta");
}

async function seed(): Promise<void> {
	await db.insert(legacyOtus).values({
		id: "otu",
		data: {
			_id: "otu",
			name: "Squash browning spot virus",
			isolates: [
				{ id: "iso_a", source_type: "isolate", source_name: "Ever" },
				{ id: "iso_b", source_type: "strain", source_name: "Never" },
			],
		},
		name: "Squash browning spot virus",
		abbreviation: "SBSV",
		reference_id: referenceId,
		verified: true,
		version: 3,
	});

	await db.insert(legacySequences).values([
		{
			id: "seq_a1",
			data: { _id: "seq_a1", sequence: "ATGC" },
			otu_id: "otu",
			isolate_id: "iso_a",
			segment: null,
			position: 1,
		},
		{
			id: "seq_a0",
			data: { _id: "seq_a0", sequence: "GGGG" },
			otu_id: "otu",
			isolate_id: "iso_a",
			segment: null,
			position: 0,
		},
		{
			id: "seq_b",
			data: { _id: "seq_b", sequence: "TTTTTT" },
			otu_id: "otu",
			isolate_id: "iso_b",
			segment: null,
			position: 2,
		},
	]);
}

describe("handleOtuFasta", () => {
	it("refuses an anonymous caller", async () => {
		await seed();

		expect((await handleOtuFasta(anonymous(), "otu")).status).toBe(401);
	});

	it("emits every sequence, by isolate then position", async () => {
		await seed();

		const response = await handleOtuFasta(signedIn(), "otu");

		expect(response.status).toBe(200);
		expect(await response.text()).toBe(
			[
				">Squash browning spot virus|Isolate Ever|seq_a0|4",
				"GGGG",
				">Squash browning spot virus|Isolate Ever|seq_a1|4",
				"ATGC",
				">Squash browning spot virus|Strain Never|seq_b|6",
				"TTTTTT",
			].join("\n"),
		);
	});

	it("names the download after the OTU, lower-cased with spaces replaced", async () => {
		await seed();

		const response = await handleOtuFasta(signedIn(), "otu");

		// Every space is replaced, not just the first.
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="squash_browning_spot_virus.fa"',
		);
		expect(response.headers.get("content-type")).toBe(
			"text/plain; charset=utf-8",
		);
	});

	it("escapes a name that would otherwise malform the header", async () => {
		// An OTU name is free text. A quote or semicolon makes an unquoted
		// `filename` ambiguous, and a newline makes the `Response` constructor
		// throw outright.
		const name = 'Weird "virus"; \n α';

		await db.insert(legacyOtus).values({
			id: "weird",
			data: { _id: "weird", name, isolates: [] },
			name,
			abbreviation: "",
			reference_id: referenceId,
			verified: true,
			version: 0,
		});

		const response = await handleOtuFasta(signedIn(), "weird");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="weird__virus______.fa"; ' +
				"filename*=UTF-8''weird_%22virus%22%3B_%0A_%CE%B1.fa",
		);
	});

	it("404s for an OTU that does not exist", async () => {
		await seed();

		expect((await handleOtuFasta(signedIn(), "nope")).status).toBe(404);
	});

	it("serves an OTU with no sequences as an empty body", async () => {
		await seed();
		await db.delete(legacySequences);

		const response = await handleOtuFasta(signedIn(), "otu");

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("");
	});
});

describe("handleIsolateFasta", () => {
	it("emits only the named isolate's sequences", async () => {
		await seed();

		const response = await handleIsolateFasta(signedIn(), "otu", "iso_b");

		expect(await response.text()).toBe(
			">Squash browning spot virus|Strain Never|seq_b|6\nTTTTTT",
		);
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="squash_browning_spot_virus.strain_never.fa"',
		);
	});

	it("404s for an isolate the OTU does not carry", async () => {
		await seed();

		expect((await handleIsolateFasta(signedIn(), "otu", "nope")).status).toBe(
			404,
		);
	});

	it("refuses an anonymous caller", async () => {
		await seed();

		expect((await handleIsolateFasta(anonymous(), "otu", "iso_a")).status).toBe(
			401,
		);
	});
});

describe("handleSequenceFasta", () => {
	it("emits the one sequence, named for all three parts", async () => {
		await seed();

		const response = await handleSequenceFasta(
			signedIn(),
			"otu",
			"iso_a",
			"seq_a0",
		);

		expect(await response.text()).toBe(
			">Squash browning spot virus|Isolate Ever|seq_a0|4\nGGGG",
		);
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="squash_browning_spot_virus.isolate_ever.seq_a0.fa"',
		);
	});

	it("404s when the sequence belongs to a different isolate", async () => {
		await seed();

		// `seq_b` exists, but not under `iso_a`. Reading by id alone would export
		// it through a URL that misnames its isolate.
		expect(
			(await handleSequenceFasta(signedIn(), "otu", "iso_a", "seq_b")).status,
		).toBe(404);
	});

	it("404s for a sequence that does not exist", async () => {
		await seed();

		expect(
			(await handleSequenceFasta(signedIn(), "otu", "iso_a", "nope")).status,
		).toBe(404);
	});

	it("refuses an anonymous caller", async () => {
		await seed();

		expect(
			(await handleSequenceFasta(anonymous(), "otu", "iso_a", "seq_a0")).status,
		).toBe(401);
	});
});
