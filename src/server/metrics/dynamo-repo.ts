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
import type {
  DailyRecord,
  EventRecord,
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

function siteFrom(item: Item): SiteRecord {
  return {
    siteKey: requiredString(item, "siteKey"),
    name: requiredString(item, "name"),
    createdAt: requiredString(item, "createdAt"),
    pageviewCount: requiredNumber(item, "pageviewCount"),
    visitorCount: requiredNumber(item, "visitorCount"),
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
  }

  async listSites(): Promise<SiteRecord[]> {
    const items = await this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "SITE" },
    });
    return items.map(siteFrom).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
