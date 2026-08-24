import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { bannerColors } from "@virtool/contracts";
import {
	BannerNotFoundError,
	clearActiveBanner,
	createBanner,
	deleteBanner,
	findBanner,
	findBanners,
	setActiveBanner,
	updateBanner,
} from "@virtool/data/banners/data";
import { z } from "zod";
import { adminRole, authenticated } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { rowIdSchema } from "../validation";

const colorSchema = z.enum(bannerColors);

const idSchema = z.object({ id: rowIdSchema });

const createBannerSchema = z.object({
	message: z.string().min(1, "Message cannot be empty."),
	color: colorSchema,
});

const updateBannerSchema = idSchema
	.extend({
		message: z.string().min(1, "Message cannot be empty.").optional(),
		color: colorSchema.optional(),
	})
	.refine((data) => data.message !== undefined || data.color !== undefined, {
		message: "At least one of `message` or `color` must be provided.",
	});

// Wrapped in createServerOnlyFn so the compiler can strip this body — and the
// BannerNotFoundError import it references — from the client bundle.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof BannerNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Banner not found.");
	}
	throw err;
});

export const findBannerFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async () => findBanner(db));

export const findBannersFn = createServerFn({ method: "GET" })
	.middleware([adminRole("settings")])
	.handler(async () => findBanners(db));

export const createBannerFn = createServerFn({ method: "POST" })
	.middleware([adminRole("settings")])
	.validator(createBannerSchema)
	.handler(async ({ context, data }) => {
		const banner = await createBanner(
			db,
			data.message,
			data.color,
			context.session.userId,
		);
		setResponseStatus(201);
		return banner;
	});

export const updateBannerFn = createServerFn({ method: "POST" })
	.middleware([adminRole("settings")])
	.validator(updateBannerSchema)
	.handler(async ({ context, data }) => {
		try {
			return await updateBanner(
				db,
				data.id,
				{ message: data.message, color: data.color },
				context.session.userId,
			);
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

export const deleteBannerFn = createServerFn({ method: "POST" })
	.middleware([adminRole("settings")])
	.validator(idSchema)
	.handler(async ({ data }) => {
		try {
			await deleteBanner(db, data.id);
			return null;
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

export const setActiveBannerFn = createServerFn({ method: "POST" })
	.middleware([adminRole("settings")])
	.validator(idSchema)
	.handler(async ({ data }) => {
		try {
			return await setActiveBanner(db, data.id);
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

export const clearActiveBannerFn = createServerFn({ method: "POST" })
	.middleware([adminRole("settings")])
	.handler(async () => {
		await clearActiveBanner(db);
		return null;
	});
