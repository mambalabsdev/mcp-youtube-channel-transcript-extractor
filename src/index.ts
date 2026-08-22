#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(here, "..", "package.json"), "utf8"),
) as { version: string; name: string };

// Distinctive UA so Apify run meta.userAgent marks MCP-originated runs.
const USER_AGENT = `mambalabs-mcp ${pkg.name}@${pkg.version}`;

const APIFY_TOKEN = process.env.APIFY_TOKEN;

type ToolResult = {
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
};

// Drop undefined values so optional inputs are not sent to the actor at all.
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// The actor types its switches as strings ("true"/"false") for Clay
// compatibility, because Clay sends every input as a string and a boolean typed
// field silently receives "false" and reads it as truthy. The model gets a real
// boolean and the actor gets the string it validates.
function boolToString(v: boolean | undefined): string | undefined {
  return v === undefined ? undefined : v ? "true" : "false";
}

// actorPath is the actor's IMMUTABLE Apify actor id, not its slug, so a Store
// rename never breaks these calls.
async function runActor(
  actorPath: string,
  actorLabel: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  if (!APIFY_TOKEN) {
    return { isError: true, content: [{ type: "text", text: "APIFY_TOKEN is not set. Create a token at https://console.apify.com/account/integrations and set it as the APIFY_TOKEN environment variable." }] };
  }

  // memory=1024 is deliberate and matches the actor's declared
  // defaultRunOptions.memoryMbytes. run-sync-get-dataset-items runs at 2048 MB
  // unless told otherwise, and `apify-actor-start` bills once per GB with a
  // minimum of one, so leaving the default in place would charge the caller
  // more start events per run than the actor asks for. Keep this in step with
  // the actor's defaultRunOptions.
  const url = `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?timeout=300&memory=1024`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${APIFY_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(input),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: `Could not reach the Apify API: ${message}` }] };
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = ` ${body.error.message}`;
    } catch {
      detail = "";
    }

    let message: string;
    switch (response.status) {
      case 401:
        message = "Invalid Apify token. Check your APIFY_TOKEN environment variable.";
        break;
      case 402:
        message = "Insufficient Apify credits. Check your account balance at https://console.apify.com/billing";
        break;
      case 408:
        message = `The ${actorLabel} run timed out after 300 seconds. Try again, or run the actor on Apify directly for longer jobs.`;
        break;
      default:
        message = `Apify request to ${actorLabel} failed with status ${response.status}.${detail}`;
    }
    return { isError: true, content: [{ type: "text", text: message }] };
  }

  // A 2xx normally carries the dataset array. Pass actor output through
  // unchanged: the wrapper must never reinterpret a status field, because
  // not_extractable, blocked and not_found are different answers and collapsing
  // them is exactly the defect the actor was built to avoid.
  const items = await response.json();
  return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
}

const server = new McpServer({
  name: "mamba-youtube-channel-stats",
  version: pkg.version,
});

// YouTube Channel Stats Extractor (immutable actor ID 6hSpD3kd2s2IQ4VSs)
server.registerTool(
  "get_youtube_channel_stats",
  {
    title: "Get YouTube Channel Stats",
    description:
      "Resolve a company domain, or a YouTube handle, to that company's YouTube channel. Returns the subscriber count, the stable UC channel id, channel name, creation date and description, as one flat Clay ready row. Subscriber counts are rounded by YouTube above roughly a thousand subscribers, on the page and in its official API alike, and the row flags that. Optional transcript pulling is available and is CURRENTLY GATED by YouTube: the caption track list is readable and the caption content endpoint returns an empty body without a proof of origin token, which the row reports as not_extractable rather than as a video having no captions. No API key needed. Read only; requires an APIFY_TOKEN and consumes Apify credits per call.",
    annotations: {
      title: "Get YouTube Channel Stats",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    inputSchema: {
      company_domain: z.string()
        .optional()
        .describe("Bare company domain, for example shopify.com. Supply this or a handle. With a domain the actor runs full discovery; with a handle it skips straight to the fetch."),
      company_name: z.string()
        .optional()
        .describe("Optional. Improves search accuracy and is what the identity gate checks a discovered profile against, so supplying it reduces wrong matches."),
      handle: z.string()
        .optional()
        .describe("Optional. A YouTube handle such as @shopify, or a full channel URL. Supplying it skips discovery and goes straight to the channel."),
      includeFollowerCounts: z.boolean()
        .optional()
        .describe("When \"true\" (default) the profile page is fetched and the counts are extracted. Set \"false\" to resolve the profile URL only, which is cheaper and needs no proxy. Sent as a string for Clay compatibility."),
      skipCache: z.boolean()
        .optional()
        .describe("When \"false\" (default) a successful lookup is cached for seven days and reused. Set \"true\" to force a fresh fetch. Sent as a string for Clay compatibility."),
      includeTranscripts: z.boolean()
        .optional()
        .describe("When \"true\", full timestamped transcripts are pulled for the most recent videos on the channel and returned as one row per video. Default is \"false\" because transcripts are the expensive half of this actor and most buyers want channel stats only. Sent as a string for Clay compatibility."),
      transcriptVideoCount: z.string()
        .optional()
        .describe("How many of the channel's most recent videos to pull transcripts for, when transcripts are on. Default 5. Each video is one extra fetch and one extra billable transcript event, so this is the dial that sets the cost of a transcript run."),
    },
  },
  async ({ company_domain, company_name, handle, includeFollowerCounts, skipCache, includeTranscripts, transcriptVideoCount }) => {
    return runActor(
      "6hSpD3kd2s2IQ4VSs",
      "YouTube Channel Stats Extractor",
      compact({
        company_domain,
        company_name,
        handle,
        includeFollowerCounts: boolToString(includeFollowerCounts),
        skipCache: boolToString(skipCache),
        includeTranscripts: boolToString(includeTranscripts),
        transcriptVideoCount,
      }),
    );
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
