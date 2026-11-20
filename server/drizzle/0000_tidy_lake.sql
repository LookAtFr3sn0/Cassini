CREATE TYPE "public"."token_kind" AS ENUM('lastfm', 'listenbrainz', 'api');--> statement-breakpoint
CREATE TABLE "albums" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "albums_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"artist_id" bigint NOT NULL,
	"title" text NOT NULL,
	"title_key" text NOT NULL,
	"mbid" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "albums_mbid_unique" UNIQUE("mbid")
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "token_kind" NOT NULL,
	"token_hash" text NOT NULL,
	"name" text,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "artists_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"mbid" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artists_nameKey_unique" UNIQUE("name_key"),
	CONSTRAINT "artists_mbid_unique" UNIQUE("mbid")
);
--> statement-breakpoint
CREATE TABLE "now_playing" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"track_id" bigint NOT NULL,
	"album_id" bigint,
	"started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrobbles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scrobbles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"track_id" bigint NOT NULL,
	"album_id" bigint,
	"played_at" timestamp with time zone NOT NULL,
	"client" text,
	"imported_from" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tracks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"artist_id" bigint NOT NULL,
	"title" text NOT NULL,
	"title_key" text NOT NULL,
	"duration_ms" integer,
	"mbid" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracks_mbid_unique" UNIQUE("mbid")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "now_playing" ADD CONSTRAINT "now_playing_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "now_playing" ADD CONSTRAINT "now_playing_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "now_playing" ADD CONSTRAINT "now_playing_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrobbles" ADD CONSTRAINT "scrobbles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrobbles" ADD CONSTRAINT "scrobbles_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrobbles" ADD CONSTRAINT "scrobbles_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "albums_artist_title_idx" ON "albums" USING btree ("artist_id","title_key");--> statement-breakpoint
CREATE INDEX "api_tokens_user_idx" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scrobbles_dedupe_idx" ON "scrobbles" USING btree ("user_id","played_at","track_id");--> statement-breakpoint
CREATE INDEX "scrobbles_user_played_idx" ON "scrobbles" USING btree ("user_id","played_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_artist_title_idx" ON "tracks" USING btree ("artist_id","title_key");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "users" USING btree (lower("username"));