import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Params, Result, Handler } from "../lastfm/shared.js";
import formbody from "@fastify/formbody";
import { LastfmError, LastfmErrorCode, toXml } from "../lastfm/shared.js";
import { getMobileSession } from "../lastfm/auth.js";
import { updateNowPlaying } from "../lastfm/track.js";

function notImplemented(name: string): Handler {
    return async () => {
        throw new LastfmError(LastfmErrorCode.InvalidMethod, `Method ${name} is not implemented`);
    }
}

const handlers: Record<string, Handler> = {
    "auth.getMobileSession": getMobileSession,
    "track.updateNowPlaying": updateNowPlaying,
    "track.scrobble": notImplemented("track.scrobble")
};

function send(reply: FastifyReply, wantsJson: boolean, status: number, json: Result, xmlSource: Result = json) {
    if (wantsJson) {
        return reply.code(status).send(json);
    }
    const body = Object.entries(xmlSource).map(([key, value]) => toXml(key, value)).join("");
    return reply
        .code(status)
        .type("text/xml; charset=utf-8")
        .send(`<?xml version="1.0" encoding="utf-8"?>\n<lfm status="${status === 200 ? "ok" : "failed"}">${body}</lfm>`);
}

export async function lastfmRoutes(app: FastifyInstance) {
    await app.register(formbody);

    for (const url of ["/2.0", "/2.0/"]) {
        app.route({
            method: ["GET", "POST"],
            url,
            handler: async (request: FastifyRequest, reply: FastifyReply) => {
                const params: Params = {
                    ...(request.query as Params),
                    ...(request.body as Params | undefined)
                };
                const wantsJson = params.format === "json";
                try {
                    if (Object.values(params).some((value) => typeof value !== "string")) {
                        throw new LastfmError(LastfmErrorCode.InvalidParameters, "Invalid parameters");
                    }
                    const method = params.method ?? "";
                    const handler = Object.hasOwn(handlers, method) ? handlers[method] : undefined;
                    if (!handler) {
                        throw new LastfmError(LastfmErrorCode.InvalidMethod, "Invalid method");
                    }
                    const result = await handler(params);
                    return send(reply, wantsJson, 200, result);
                } catch (err) {
                    if (!(err instanceof LastfmError)) {
                        request.log.error(err);
                        err = new LastfmError(LastfmErrorCode.ServiceTemporarilyUnavailable, "Service temporarily unavailable");
                    }
                    const e = err as LastfmError;
                    return send(reply, wantsJson, e.code === LastfmErrorCode.ServiceTemporarilyUnavailable ? 503 : 400, { error: e.code, message: e.message }, { error: { code: e.code, "#text": e.message } })
                }
            }
        });
    }
}
