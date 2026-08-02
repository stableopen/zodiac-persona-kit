import {
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const zodiacKeyValues = sqliteTable(
  "zodiac_kv",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("zodiac_kv_expires_at_idx").on(table.expiresAt),
  ],
);
