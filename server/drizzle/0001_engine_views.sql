-- Custom SQL migration file, put your code below! --
create schema if not exists engine; --> statement-breakpoint
create view engine.artists as select id, name, mbid from public.artists; --> statement-breakpoint
create view engine.albums as select id, artist_id, title, mbid from public.albums; --> statement-breakpoint
create view engine.tracks as select id, artist_id, title, duration_ms, mbid from public.tracks; --> statement-breakpoint
create view engine.plays as select user_id, track_id, album_id, played_at from public.scrobbles; --> statement-breakpoint
do $$ begin
    if not exists (select from pg_roles where rolname = 'engine_reader') then
        create role engine_reader nologin;
    end if;
end $$; --> statement-breakpoint
grant usage on schema engine to engine_reader; --> statement-breakpoint
grant select on all tables in schema engine to engine_reader;
