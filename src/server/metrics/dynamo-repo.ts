import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { nextDayKey } from "./ids";
import { compareSites, finiteOrder } from "./site-order";
import { bucketKey } from "./page-day";
import type {
  CountMap,
  DailyRecord,
  EventRecord,
  MessageRecord,
  PageDayDelta,
  PageDayRecord,
  PostRate,
  Repo,
  SiteRecord,
  VisitorRecord,
} from "./types";

type Item = Record<string, unknown>;

function requiredString(item: Item, key: string): string {
  return typeof item[key] === "string" ? item[key] : "";
}

function requiredNumber(item: Item, key: string): number {
  return typeof item[key] === "number" ? item[key] : Number(item[key] ?? 0);
}

function countsFrom(item: Item, prefix: string): CountMap {
  const counts: CountMap = {};
  for (const [key, value] of Object.entries(item)) {
    if (!key.startsWith(prefix)) continue;
    const name = key.slice(prefix.length);
    const amount = typeof value === "number" ? value : Number(value);
    if (!name || !Number.isFinite(amount) || amount === 0) continue;
    counts[name] = amount;
  }
  return counts;
}

function pageFrom(item: Item, siteKey: string): PageDayRecord {
  return {
    siteKey: requiredString(item, "siteKey") || siteKey,
    date: requiredString(item, "date"),
    path: requiredString(item, "path"),
    pageviews: requiredNumber(item, "pageviews"),
    visitors: requiredNumber(item, "visitors"),
    entrances: requiredNumber(item, "entrances"),
    durationMs: requiredNumber(item, "durationMs"),
    durationCount: requiredNumber(item, "durationCount"),
    sources: countsFrom(item, "src#"),
    devices: countsFrom(item, "dev#"),
    countries: countsFrom(item, "cty#"),
    ttl: requiredNumber(item, "ttl"),
  };
}

function siteFrom(item: Item): SiteRecord {
  const sortOrder = finiteOrder(item.sortOrder);
  return {
    siteKey: requiredString(item, "siteKey"),
    name: requiredString(item, "name"),
    createdAt: requiredString(item, "createdAt"),
    pageviewCount: requiredNumber(item, "pageviewCount"),
    visitorCount: requiredNumber(item, "visitorCount"),
    guestbookEnabled: item.guestbookEnabled === true,
    ...(sortOrder === undefined ? {} : { sortOrder }),
  };
}

function messageFrom(item: Item): MessageRecord {
  return {
    siteKey: requiredString(item, "siteKey"),
    messageId: requiredString(item, "messageId"),
    name: requiredString(item, "name"),
    email: requiredString(item, "email"),
    body: requiredString(item, "body"),
    createdAt: requiredString(item, "createdAt"),
    ip: requiredString(item, "ip"),
  };
}

function rateFrom(item: Item): PostRate {
  return {
    siteKey: requiredString(item, "siteKey"),
    ip: requiredString(item, "ip"),
    windowStart: requiredNumber(item, "windowStart"),
    count: requiredNumber(item, "count"),
    lastAt: requiredNumber(item, "lastAt"),
    lastBody: requiredString(item, "lastBody"),
    ttl: requiredNumber(item, "ttl"),
  };
}

function visitorFrom(item: Item): VisitorRecord {
  return {
    siteKey: requiredString(item, "siteKey"),
    visitorId: requiredString(item, "visitorId"),
    firstSeenAt: requiredString(item, "firstSeenAt"),
    lastSeenAt: requiredString(item, "lastSeenAt"),
    firstReferrer: requiredString(item, "firstReferrer"),
    trafficSource: requiredString(item, "trafficSource"),
    utmSource: requiredString(item, "utmSource"),
    utmMedium: requiredString(item, "utmMedium"),
    utmCampaign: requiredString(item, "utmCampaign"),
    landingPath: requiredString(item, "landingPath"),
    lastPath: requiredString(item, "lastPath"),
    ip: requiredString(item, "ip"),
    country: requiredString(item, "country"),
    city: requiredString(item, "city"),
    userAgent: requiredString(item, "userAgent"),
    device: requiredString(item, "device"),
    locale: requiredString(item, "locale"),
    pageCount: requiredNumber(item, "pageCount"),
    visitCount: requiredNumber(item, "visitCount"),
    currentSessionId: requiredString(item, "currentSessionId"),
    activeMs: requiredNumber(item, "activeMs"),
    countedDay: requiredString(item, "countedDay"),
    countedPageDay: requiredString(item, "countedPageDay"),
    countedPaths: requiredString(item, "countedPaths"),
    ttl: requiredNumber(item, "ttl"),
    rateWindowMinute: requiredNumber(item, "rateWindowMinute"),
    rateCount: requiredNumber(item, "rateCount"),
    note: requiredString(item, "note"),
    mark: requiredString(item, "mark"),
  };
}

function eventFrom(item: Item): EventRecord {
  return {
    siteKey: requiredString(item, "siteKey"),
    visitorId: requiredString(item, "visitorId"),
    eventId: requiredString(item, "eventId"),
    sessionId: requiredString(item, "sessionId"),
    occurredAt: requiredString(item, "occurredAt"),
    path: requiredString(item, "path"),
    title: requiredString(item, "title"),
    durationMs: requiredNumber(item, "durationMs"),
    ttl: requiredNumber(item, "ttl"),
  };
}

export class DynamoRepo implements Repo {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor(tableName: string) {
    if (!tableName) throw new Error("METRICS_TABLE_NAME is empty");
    this.tableName = tableName;
    this.client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async getSite(siteKey: string): Promise<SiteRecord | null> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: "SITE", sk: siteKey } }),
    );
    return result.Item ? siteFrom(result.Item) : null;
  }

  async createSite(site: SiteRecord): Promise<void> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { pk: "SITE", sk: site.siteKey, entity: "site", ...site },
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
    } catch (error) {
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
        throw new Error("site exists");
      }
      throw error;
    }
  }

  async putSite(site: SiteRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: "SITE", sk: site.siteKey, entity: "site", ...site },
      }),
    );
  }

  async deleteSite(siteKey: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({ TableName: this.tableName, Key: { pk: "SITE", sk: siteKey } }),
    );
    await this.deleteByPk(`MSG#${siteKey}`);
    await this.deleteByPk(`RATE#${siteKey}`);
  }

  async listSites(): Promise<SiteRecord[]> {
    const items = await this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "SITE" },
    });
    return items.map(siteFrom).sort(compareSites);
  }

  async getVisitor(siteKey: string, visitorId: string): Promise<VisitorRecord | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `SESS#${siteKey}`, sk: visitorId },
      }),
    );
    return result.Item ? visitorFrom(result.Item) : null;
  }

  async putVisitor(visitor: VisitorRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `SESS#${visitor.siteKey}`,
          sk: visitor.visitorId,
          gsi1pk: `SESS#${visitor.siteKey}`,
          gsi1sk: `${visitor.lastSeenAt}#${visitor.visitorId}`,
          entity: "visitor",
          ...visitor,
        },
      }),
    );
  }

  async insertEvent(event: EventRecord): Promise<"ok" | "duplicate"> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: `EV#${event.siteKey}#${event.visitorId}`,
            sk: `${event.occurredAt}#${event.eventId}`,
            entity: "event",
            ...event,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
      return "ok";
    } catch (error) {
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") return "duplicate";
      throw error;
    }
  }

  async saveEvent(event: EventRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `EV#${event.siteKey}#${event.visitorId}`,
          sk: `${event.occurredAt}#${event.eventId}`,
          entity: "event",
          ...event,
        },
      }),
    );
  }

  async listEvents(
    siteKey: string,
    visitorId: string,
    limit: number,
    order: "asc" | "desc",
  ): Promise<EventRecord[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `EV#${siteKey}#${visitorId}` },
        ScanIndexForward: order === "asc",
        Limit: limit,
      }),
    );
    return (result.Items ?? []).map(eventFrom);
  }

  async listVisitors(siteKey: string, limit: number): Promise<VisitorRecord[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "byRecent",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": `SESS#${siteKey}` },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (result.Items ?? []).map(visitorFrom);
  }

  async addDaily(
    siteKey: string,
    date: string,
    pageviews: number,
    uniques: number,
    ttl: number,
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `DAY#${siteKey}`, sk: date },
        UpdateExpression:
          "ADD pageviews :pageviews, uniques :uniques SET siteKey = :siteKey, #date = :date, #ttl = if_not_exists(#ttl, :ttl), entity = :entity",
        ExpressionAttributeNames: { "#date": "date", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":pageviews": pageviews,
          ":uniques": uniques,
          ":siteKey": siteKey,
          ":date": date,
          ":ttl": ttl,
          ":entity": "day",
        },
      }),
    );
  }

  async getDailies(siteKey: string, dates: string[]): Promise<DailyRecord[]> {
    if (dates.length === 0) return [];
    let pending = dates.map((date) => ({ pk: `DAY#${siteKey}`, sk: date }));
    const items: Item[] = [];
    for (let attempt = 0; attempt < 3 && pending.length > 0; attempt += 1) {
      const result = await this.client.send(
        new BatchGetCommand({
          RequestItems: { [this.tableName]: { Keys: pending } },
        }),
      );
      items.push(...((result.Responses?.[this.tableName] as Item[] | undefined) ?? []));
      pending = (result.UnprocessedKeys?.[this.tableName]?.Keys as Array<{ pk: string; sk: string }> | undefined) ?? [];
    }
    return items.map((item) => ({
      siteKey: requiredString(item, "siteKey") || siteKey,
      date: requiredString(item, "date") || requiredString(item, "sk"),
      pageviews: requiredNumber(item, "pageviews"),
      uniques: requiredNumber(item, "uniques"),
      ttl: requiredNumber(item, "ttl"),
    }));
  }

  async addPageDay(siteKey: string, date: string, path: string, delta: PageDayDelta, ttl: number): Promise<void> {
    const names: Record<string, string> = { "#date": "date", "#path": "path", "#ttl": "ttl" };
    const values: Record<string, unknown> = {
      ":siteKey": siteKey,
      ":date": date,
      ":path": path,
      ":ttl": ttl,
      ":entity": "page",
    };
    const adds: string[] = [];
    let index = 0;
    const addNumber = (attribute: string, amount: number | undefined) => {
      if (!amount) return;
      const name = `#n${index}`;
      const value = `:v${index}`;
      names[name] = attribute;
      values[value] = amount;
      adds.push(`${name} ${value}`);
      index += 1;
    };
    const addMap = (prefix: string, counts: CountMap | undefined) => {
      const merged: CountMap = {};
      for (const [key, amount] of Object.entries(counts ?? {})) {
        if (!Number.isFinite(amount) || amount === 0) continue;
        const name = bucketKey(key);
        merged[name] = (merged[name] ?? 0) + amount;
      }
      for (const [key, amount] of Object.entries(merged)) addNumber(`${prefix}${key}`, amount);
    };

    addNumber("pageviews", delta.pageviews);
    addNumber("visitors", delta.visitors);
    addNumber("entrances", delta.entrances);
    addNumber("durationMs", delta.durationMs);
    addNumber("durationCount", delta.durationCount);
    addMap("src#", delta.sources);
    addMap("dev#", delta.devices);
    addMap("cty#", delta.countries);
    if (adds.length === 0) return;

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `PAGE#${siteKey}`, sk: `${date}#${path}` },
        UpdateExpression: `ADD ${adds.join(", ")} SET siteKey = :siteKey, #date = :date, #path = :path, #ttl = if_not_exists(#ttl, :ttl), entity = :entity`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }

  async listPageDays(siteKey: string, from: string, to: string): Promise<PageDayRecord[]> {
    const items = await this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: "pk = :pk AND sk BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":pk": `PAGE#${siteKey}`,
        ":start": `${from}#`,
        ":end": `${nextDayKey(to)}#`,
      },
    });
    return items.map((item) => pageFrom(item, siteKey)).filter((page) => page.date >= from && page.date <= to && page.path);
  }

  async listMessages(siteKey: string, limit: number): Promise<MessageRecord[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "byRecent",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": `MSG#${siteKey}` },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (result.Items ?? []).map(messageFrom);
  }

  async insertMessage(message: MessageRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `MSG#${message.siteKey}`,
          sk: message.messageId,
          gsi1pk: `MSG#${message.siteKey}`,
          gsi1sk: `${message.createdAt}#${message.messageId}`,
          entity: "message",
          ...message,
        },
      }),
    );
  }

  async deleteMessage(siteKey: string, messageId: string): Promise<boolean> {
    try {
      await this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { pk: `MSG#${siteKey}`, sk: messageId },
          ConditionExpression: "attribute_exists(pk)",
        }),
      );
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") return false;
      throw error;
    }
  }

  async getPostRate(siteKey: string, ip: string): Promise<PostRate | null> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: `RATE#${siteKey}`, sk: ip } }),
    );
    return result.Item ? rateFrom(result.Item) : null;
  }

  async putPostRate(rate: PostRate): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `RATE#${rate.siteKey}`,
          sk: rate.ip,
          entity: "rate",
          ...rate,
        },
      }),
    );
  }

  private async deleteByPk(pk: string): Promise<void> {
    const items = await this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
    });
    for (const item of items) {
      const sk = item.sk;
      if (typeof sk !== "string") continue;
      await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: { pk, sk } }));
    }
  }

  private async queryAll(input: ConstructorParameters<typeof QueryCommand>[0]): Promise<Item[]> {
    const items: Item[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(
        new QueryCommand({ ...input, ExclusiveStartKey: startKey }),
      );
      items.push(...((result.Items as Item[] | undefined) ?? []));
      startKey = result.LastEvaluatedKey;
    } while (startKey);
    return items;
  }
}
