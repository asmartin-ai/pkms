import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { join } from "node:path";
import { homedir } from "node:os";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

export const EMBEDDING_REVISION = "751bff37182d3f1213fa05d7196b954e230abad9";

export const EMBEDDING_DIMENSIONS = 384;

export const EMBEDDING_VERSION = `${EMBEDDING_MODEL}@${EMBEDDING_REVISION}:q8:mean:normalized:chunks-v2`;

let queue: Promise<unknown> = Promise.resolve();

let extractor: FeatureExtractionPipeline | undefined;

async function createExtractor(download: boolean) {
  env.cacheDir = process.env["KHAOS_MODEL_CACHE"] || join(homedir(), ".cache", "khaos", "models");
  env.allowRemoteModels = download;

  try {
    return await pipeline(
      "feature-extraction",
      download ? EMBEDDING_MODEL : join(env.cacheDir, EMBEDDING_MODEL, EMBEDDING_REVISION),
      {
        revision: EMBEDDING_REVISION,
        dtype: "q8",
        device: "cpu",
        local_files_only: !download,
      },
    );
  } finally {
    env.allowRemoteModels = false;
  }
}

export function localEmbed(
  text: string,
  opts: { offline?: boolean; allowDownload?: boolean } = {},
): Promise<Float32Array> {
  const run = queue
    .catch(() => {})
    .then(async () => {
      extractor ??= await createExtractor(opts.allowDownload === true && opts.offline !== true);

      if (extractor.tokenizer.encode(text).length > 256)
        throw new Error("Text exceeds the local embedding token window; shorten the query");

      const result = await extractor(text, {
        pooling: "mean",
        normalize: true,
      });

      const vector = result.data;

      if (
        !(vector instanceof Float32Array) ||
        vector.length !== EMBEDDING_DIMENSIONS ||
        !vector.every(Number.isFinite)
      ) {
        throw new Error("Embedding model returned an invalid vector");
      }

      return vector;
    });

  queue = run;

  return run;
}
