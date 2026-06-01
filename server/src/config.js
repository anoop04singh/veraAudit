import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",

  tatumApiKey: process.env.TATUM_API_KEY ?? "",
  tatumSuiRpc: process.env.TATUM_SUI_RPC ?? "https://sui-testnet.gateway.tatum.io",

  walrusPublisher:
    process.env.WALRUS_PUBLISHER ?? "https://publisher.walrus-testnet.walrus.space",
  walrusAggregator:
    process.env.WALRUS_AGGREGATOR ?? "https://aggregator.walrus-testnet.walrus.space",
  walrusEpochs: Number(process.env.WALRUS_EPOCHS ?? 10),

  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
  geminiEmbeddingDimensions: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? 768),

  registryPackageId: process.env.REGISTRY_PACKAGE_ID ?? "",
  registryObjectId: process.env.REGISTRY_OBJECT_ID ?? "",
  suiPrivateKey: process.env.SUI_PRIVATE_KEY ?? "",

  appNetworkLabel: process.env.APP_NETWORK_LABEL ?? "sui:testnet",

  retryMaxAttempts: Number(process.env.RETRY_MAX_ATTEMPTS ?? 4),
  retryBaseDelayMs: Number(process.env.RETRY_BASE_DELAY_MS ?? 1500),
  retryMaxDelayMs: Number(process.env.RETRY_MAX_DELAY_MS ?? 30000),
  contextModuleQueryConcurrency: Number(process.env.CONTEXT_MODULE_QUERY_CONCURRENCY ?? 2),
  maxContextFunctionQueries: Number(process.env.MAX_CONTEXT_FUNCTION_QUERIES ?? 12),
  contextTransactionsPerFunction: Number(process.env.CONTEXT_TRANSACTIONS_PER_FUNCTION ?? 5),
  maxContextTransactions: Number(process.env.MAX_CONTEXT_TRANSACTIONS ?? 25),
  maxContextEvents: Number(process.env.MAX_CONTEXT_EVENTS ?? 50),
  maxModuleCharsForAudit: Number(process.env.MAX_MODULE_CHARS_FOR_AUDIT ?? 120000),
  maxTransactionCharsForAudit: Number(process.env.MAX_TRANSACTION_CHARS_FOR_AUDIT ?? 40000),
  maxEventCharsForAudit: Number(process.env.MAX_EVENT_CHARS_FOR_AUDIT ?? 30000),
  tatumMinIntervalMs: Number(process.env.TATUM_MIN_INTERVAL_MS ?? 450),
  suiAnchorRpcFallback: process.env.SUI_ANCHOR_RPC_FALLBACK ?? "https://fullnode.testnet.sui.io:443",
  ragEnabled: process.env.RAG_ENABLED !== "false",
  ragUseEmbeddings: process.env.RAG_USE_EMBEDDINGS !== "false",
  ragTopK: Number(process.env.RAG_TOP_K ?? 8),
  ragEmbeddingRetryMaxAttempts: Number(process.env.RAG_EMBEDDING_RETRY_MAX_ATTEMPTS ?? 2),
  maxRagCharsForAudit: Number(process.env.MAX_RAG_CHARS_FOR_AUDIT ?? 20000),
};

export function assertHas(key, value) {
  if (!value) {
    throw new Error(`${key} is not set.`);
  }
}
