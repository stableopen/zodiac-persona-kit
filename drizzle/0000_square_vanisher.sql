CREATE TABLE `zodiac_kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer,
	`updated_at` integer NOT NULL
);
