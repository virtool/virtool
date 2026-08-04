import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	createLabel,
	deleteLabel,
	findLabels,
	getLabel,
	LabelConflictError,
	LabelNotFoundError,
	updateLabel,
} from "@virtool/data/labels/data";
import { z } from "zod";
import { authenticated } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { rowIdSchema } from "../validation";

const colorSchema = z
	.string()
	.regex(/^#?[0-9a-fA-F]{6}$/, "Color must be a hex color.");

function normalizeColor(color: string): string {
	return color.startsWith("#") ? color : `#${color}`;
}

function normalizeValues<T extends { color?: string }>(values: T): T {
	if (values.color === undefined) {
		return values;
	}
	return { ...values, color: normalizeColor(values.color) };
}

const labelValuesSchema = z.object({
	color: colorSchema,
	description: z.string().default(""),
	name: z.string().min(1),
});

const labelIdSchema = z.object({
	labelId: rowIdSchema,
});

const findLabelsSchema = z.object({ term: z.string().default("") }).optional();

// Wrapped in createServerOnlyFn so the compiler can strip this body — and the
// LabelNotFoundError / LabelConflictError imports it references — from the
// client bundle. A plain top-level helper would pin ./data and its postgres
// transitive dependency in the client graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof LabelNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Label not found.");
	}
	if (err instanceof LabelConflictError) {
		setResponseStatus(409);
		throw new ClientError("Label name already exists.");
	}
	throw err;
});

export const findLabelsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findLabelsSchema)
	.handler(async ({ data }) => findLabels(db, data?.term ?? ""));

export const getLabelFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(labelIdSchema)
	.handler(async ({ data }) => {
		try {
			return await getLabel(db, data.labelId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const createLabelFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(labelValuesSchema)
	.handler(async ({ data }) => {
		try {
			const label = await createLabel(db, normalizeValues(data));
			setResponseStatus(201);
			return label;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateLabelFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(labelIdSchema.extend(labelValuesSchema.partial().shape))
	.handler(async ({ data }) => {
		const { labelId, ...values } = data;
		try {
			return await updateLabel(db, labelId, normalizeValues(values));
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const deleteLabelFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(labelIdSchema)
	.handler(async ({ data }) => {
		try {
			await deleteLabel(db, data.labelId);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
