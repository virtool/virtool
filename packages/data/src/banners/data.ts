import type { BannerColor } from "@virtool/contracts";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { banners } from "../db/schema/banners";
import { users } from "../db/schema/users";
import { AppError } from "../errors";
import { emit } from "../events/emit";

/** The author reference attached to a banner. */
type BannerUser = {
	id: number;
	handle: string;
};

/** An administrative banner displayed to all logged-in users. */
export type Banner = {
	id: number;
	active: boolean;
	color: BannerColor;
	message: string;

	/** When the banner was written, or null if the row does not record it. */
	createdAt: Date | null;

	/** When the banner was last changed, or null if the row does not record it. */
	updatedAt: Date | null;

	user: BannerUser;
};

/** Thrown when a requested banner does not exist. */
export class BannerNotFoundError extends AppError {}

type BannerJoinRow = {
	id: number;
	active: boolean | null;
	color: BannerColor;
	message: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
	user: BannerUser;
};

const bannerSelect = {
	id: banners.id,
	active: banners.active,
	color: banners.color,
	message: banners.message,
	createdAt: banners.createdAt,
	updatedAt: banners.updatedAt,
	user: {
		id: users.id,
		handle: users.handle,
	},
} as const;

function toBanner(row: BannerJoinRow): Banner {
	return {
		id: row.id,
		active: row.active ?? false,
		color: row.color,
		message: row.message ?? "",
		// Passed through, never defaulted. Substituting `new Date()` for a missing
		// timestamp does not hide the gap, it fabricates a current one — a banner
		// with no recorded time would read as having just been written.
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		user: row.user,
	};
}

export async function findBanner(db: Db): Promise<Banner | null> {
	const [row] = await db
		.select(bannerSelect)
		.from(banners)
		.innerJoin(users, eq(users.id, banners.userId))
		.where(eq(banners.active, true))
		.limit(1);

	return row ? toBanner(row) : null;
}

export async function findBanners(db: Db): Promise<Banner[]> {
	const rows = await db
		.select(bannerSelect)
		.from(banners)
		.innerJoin(users, eq(users.id, banners.userId))
		.orderBy(desc(banners.createdAt));

	return rows.map(toBanner);
}

async function getBannerById(db: Db, id: number): Promise<Banner> {
	const [row] = await db
		.select(bannerSelect)
		.from(banners)
		.innerJoin(users, eq(users.id, banners.userId))
		.where(eq(banners.id, id))
		.limit(1);

	if (!row) {
		throw new BannerNotFoundError();
	}

	return toBanner(row);
}

export async function createBanner(
	db: Db,
	message: string,
	color: BannerColor,
	userId: number,
): Promise<Banner> {
	const now = new Date();
	const row = takeFirstOrThrow(
		await db
			.insert(banners)
			.values({
				active: false,
				color,
				message,
				createdAt: now,
				updatedAt: now,
				userId,
			})
			.returning({ id: banners.id }),
	);

	await emit("banners", row.id, "create");

	return getBannerById(db, row.id);
}

export async function updateBanner(
	db: Db,
	id: number,
	values: { message?: string; color?: BannerColor },
	userId: number,
): Promise<Banner> {
	const update: Partial<typeof banners.$inferInsert> = {
		userId,
		updatedAt: new Date(),
	};
	if (values.color !== undefined) {
		update.color = values.color;
	}
	if (values.message !== undefined) {
		update.message = values.message;
	}

	const [row] = await db
		.update(banners)
		.set(update)
		.where(eq(banners.id, id))
		.returning({ id: banners.id });

	if (!row) {
		throw new BannerNotFoundError();
	}

	await emit("banners", row.id, "update");

	return getBannerById(db, row.id);
}

export async function deleteBanner(db: Db, id: number): Promise<void> {
	const [row] = await db
		.delete(banners)
		.where(eq(banners.id, id))
		.returning({ id: banners.id });

	if (!row) {
		throw new BannerNotFoundError();
	}

	await emit("banners", row.id, "delete");
}

export async function setActiveBanner(db: Db, id: number): Promise<Banner> {
	const row = await db.transaction(async (tx) => {
		await tx
			.update(banners)
			.set({ active: false })
			.where(eq(banners.active, true));

		const [updated] = await tx
			.update(banners)
			.set({ active: true })
			.where(eq(banners.id, id))
			.returning({ id: banners.id });

		if (!updated) {
			throw new BannerNotFoundError();
		}

		return updated;
	});

	await emit("banners", row.id, "update");

	return getBannerById(db, row.id);
}

export async function clearActiveBanner(db: Db): Promise<void> {
	const rows = await db
		.update(banners)
		.set({ active: false })
		.where(eq(banners.active, true))
		.returning({ id: banners.id });

	// Any id will do — the broadcast handler re-resolves the active row via
	// findBanner().
	const resourceId = rows[0]?.id ?? 0;
	await emit("banners", resourceId, "update");
}
