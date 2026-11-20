import { sql } from "drizzle-orm";
import { escapeLiteral } from "pg";
import { db } from "./index.js";

export async function ensureEngineLogin(password: string | undefined) {
    if (!password) return;

    await db.execute(sql.raw(`
        do $$ begin
            if not exists (select from pg_roles where rolname = 'recommender') then
                create role recommender login in role engine_reader;
            end if;
        end $$;
        `));
    await db.execute(sql.raw(`alter role recommender password ${escapeLiteral(password)};`));
}
