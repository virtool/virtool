// Mirror of the `instance_messages` table. Schema and migrations are owned by
// the upstream Python service via Alembic — do not generate or push migrations
// from this side. The legacy `"user"` VARCHAR column still exists in the DB
// during the upstream cleanup window but is not declared here; Drizzle ignores
// columns it does not know about.

import {
	boolean,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const messageColor = pgEnum("messagecolor", [
	"red",
	"yellow",
	"blue",
	"purple",
	"orange",
	"grey",
]);

export const instanceMessages = pgTable("instance_messages", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	active: boolean("active").$defaultFn(() => true),
	color: messageColor("color").notNull(),
	message: text("message"),
	createdAt: timestamp("created_at"),
	updatedAt: timestamp("updated_at"),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id),
});

/** A row from the `instance_messages` table. */
export type InstanceMessageRow = typeof instanceMessages.$inferSelect;

/** One of the allowed instance-message colors stored in `instance_messages.color`. */
export type MessageColor = (typeof messageColor.enumValues)[number];
