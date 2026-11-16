import type { FastifyInstance } from "fastify";
import { count } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../auth/password.js";
import { config } from "../config.js";

const body = {
    type: "object",
    required: ["username", "email", "password"],
    additionalProperties: false,
    properties: {
        username: { type: "string", pattern: "^[A-Za-z0-9_-]+$", minLength: 3, maxLength: 32 },
        email: { type: "string", pattern: "^[^@\\s]+@[^@\\s]+$", maxLength: 255 },
        password: { type: "string", minLength: 8, maxLength: 256 },
    },
} as const;

type SignupBody = { username: string; email: string; password: string };

export async function signupRoutes(app: FastifyInstance) {
    app.post<{ Body: SignupBody }>("/api/signup", { schema: { body } }, async (request, reply) => {
        const { username, email, password } = request.body;

        const [existing] = await db.select({ total: count() }).from(users);
        const isFirstUser = existing!.total === 0;
        
        if (config.singleUser && !isFirstUser) {
            return reply.code(403).send({ error: "Signups are disabled on this instance" });
        }

        const [user] = await db
            .insert(users)
            .values({ username, email:email.toLowerCase(), passwordHash: await hashPassword(password), isAdmin: isFirstUser })
            .onConflictDoNothing()
            .returning({ id: users.id, username: users.username });

        if (!user) {
            return reply.code(409).send({ error: "Username or email already exists" });
        }
        return reply.code(201).send(user);
    });
}
