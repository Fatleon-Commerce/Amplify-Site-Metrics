import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, BillingMode, ProjectionType, Table } from "aws-cdk-lib/aws-dynamodb";
import { AnyPrincipal } from "aws-cdk-lib/aws-iam";
import { FunctionUrlAuthType, HttpMethod } from "aws-cdk-lib/aws-lambda";
import { defineBackend } from "@aws-amplify/backend";
import { metricsApi } from "./functions/metrics-api/resource.ts";

const backend = defineBackend({
  metricsApi,
});

const stack = backend.createStack("metricsData");
const table = new Table(stack, "MetricsTable", {
  partitionKey: { name: "pk", type: AttributeType.STRING },
  sortKey: { name: "sk", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: "ttl",
  removalPolicy: RemovalPolicy.RETAIN,
});

table.addGlobalSecondaryIndex({
  indexName: "byRecent",
  partitionKey: { name: "gsi1pk", type: AttributeType.STRING },
  sortKey: { name: "gsi1sk", type: AttributeType.STRING },
  projectionType: ProjectionType.ALL,
});

const lambda = backend.metricsApi.resources.lambda;
table.grantReadWriteData(lambda);
backend.metricsApi.addEnvironment("METRICS_TABLE_NAME", table.tableName);

const functionUrl = lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ["*"],
    allowedHeaders: ["content-type"],
    allowedMethods: [HttpMethod.POST],
  },
});

lambda.addPermission("MetricsApiFunctionUrl", {
  principal: new AnyPrincipal(),
  action: "lambda:InvokeFunctionUrl",
  functionUrlAuthType: FunctionUrlAuthType.NONE,
});

backend.addOutput({
  custom: {
    metricsApiUrl: functionUrl.url,
  },
});
