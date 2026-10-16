import { DynamoRepo } from "../../../src/server/metrics/dynamo-repo";
import {
  collectEvent,
  createNamedSite,
  listSiteSummaries,
  loadDetail,
  loadOverview,
  loadVisitors,
  loginWithPassword,
  removeSite,
  saveVisitorNote,
  tokenIsValid,
} from "../../../src/server/metrics/service";
import { isClientId, isSiteKey } from "../../../src/server/metrics/ids";
import type { CollectMeta } from "../../../src/server/metrics/types";

type FunctionUrlEvent = {
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string; sourceIp?: string } };
};

type Json = Record<string, unknown>;

const headers = { "content-type": "application/json; charset=utf-8" };

function respond(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function password(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

let cachedRepo: DynamoRepo | undefined;

function repo(): DynamoRepo {
  cachedRepo ??= new DynamoRepo(process.env.METRICS_TABLE_NAME ?? "");
  return cachedRepo;
}

function readBody(event: FunctionUrlEvent): Json {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Json;
}

function metaFrom(body: Json, event: FunctionUrlEvent): CollectMeta {
  const meta = body.meta;
  const record = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    ip: text(record.ip) || event.requestContext?.http?.sourceIp || "",
    userAgent: text(record.userAgent),
    country: text(record.country),
    city: text(record.city),
  };
}

export const handler = async (event: FunctionUrlEvent) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  let body: Json;
  try {
    body = readBody(event);
  } catch {
    return respond(400, { ok: false, error: "Invalid JSON" });
  }

  const op = body.op;
  const token = typeof body.token === "string" ? body.token : "";
  const store = () => repo();

  try {
    if (op === "login") {
      const attempt = typeof body.password === "string" ? body.password : "";
      const ip = typeof body.ip === "string" ? body.ip : event.requestContext?.http?.sourceIp ?? "";
      const result = await loginWithPassword(password(), attempt, ip);
      if (!result.ok) return respond(result.status, { ok: false, error: result.error });
      return respond(200, { ok: true, token: result.token });
    }

    if (op === "verify") {
      if (!tokenIsValid(password(), token)) return respond(401, { ok: false, error: "unauthorized" });
      return respond(200, { ok: true });
    }

    if (op === "siteExists") {
      const siteKey = typeof body.siteKey === "string" ? body.siteKey : "";
      if (!isSiteKey(siteKey)) return respond(200, { ok: true, exists: false });
      const site = await store().getSite(siteKey);
      return respond(200, { ok: true, exists: Boolean(site) });
    }

    if (op === "collect") {
      const result = await collectEvent(store(), body.input, metaFrom(body, event));
      if (!result.ok) return respond(result.status, result);
      return respond(200, { ok: true });
    }

    if (!tokenIsValid(password(), token)) return respond(401, { ok: false, error: "unauthorized" });

    if (op === "listSites") {
      const sites = await listSiteSummaries(store());
      return respond(200, { ok: true, sites });
    }

    if (op === "createSite") {
      const name = typeof body.name === "string" ? body.name : "";
      const result = await createNamedSite(store(), name);
      if (!result.ok) return respond(400, result);
      return respond(200, result);
    }

    if (op === "deleteSite") {
      const siteKey = typeof body.siteKey === "string" ? body.siteKey : "";
      const result = await removeSite(store(), siteKey);
      if (!result.ok) return respond(404, result);
      return respond(200, result);
    }

    if (op === "overview") {
      const siteKey = typeof body.siteKey === "string" ? body.siteKey : "";
      const overview = await loadOverview(store(), siteKey);
      if (!overview) return respond(404, { ok: false, error: "Unknown site" });
      return respond(200, { ok: true, overview });
    }

    if (op === "visitors") {
      const siteKey = typeof body.siteKey === "string" ? body.siteKey : "";
      const visitors = await loadVisitors(store(), siteKey);
      if (!visitors) return respond(404, { ok: false, error: "Unknown site" });
      return respond(200, { ok: true, visitors });
    }

    if (op === "saveNote") {
      const siteKey = typeof body.siteKey === "string" ? body.siteKey : "";
      const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
      const note = typeof body.note === "string" ? body.note : "";
      if (!isClientId(visitorId)) return respond(404, { ok: false, error: "Unknown visitor" });
      const result = await saveVisitorNote(store(), siteKey, visitorId, note);
      if (!result.ok) return respond(result.status, result);
      return respond(200, result);
    }

    if (op === "detail") {
      const siteKey = typeof body.siteKey === "string" ? body.siteKey : "";
      const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
      const detail = await loadDetail(store(), siteKey, visitorId);
      if (!detail) return respond(404, { ok: false, error: "Unknown visitor" });
      return respond(200, { ok: true, detail });
    }

    return respond(400, { ok: false, error: "Unknown operation" });
  } catch (error) {
    console.error(error);
    const isPublic = op === "collect" || op === "siteExists";
    const message = !isPublic && error instanceof Error ? error.message : "Internal error";
    return respond(500, { ok: false, error: message });
  }
};
