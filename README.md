# YouTube Channel Stats Extractor MCP Server

[![Smithery](https://smithery.ai/badge/mambabuilt/mcp-youtube-channel-transcript-extractor)](https://smithery.ai/servers/mambabuilt/mcp-youtube-channel-transcript-extractor) [![Glama score](https://glama.ai/mcp/servers/mambalabsdev/mcp-youtube-channel-transcript-extractor/badges/score.svg)](https://glama.ai/mcp/servers/mambalabsdev/mcp-youtube-channel-transcript-extractor) [![MCP Registry](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fregistry.modelcontextprotocol.io%2Fv0%2Fservers%3Fsearch%3Dcom.mambabuilt%252Fmcp-youtube-channel-transcript-extractor%26limit%3D1&query=%24.servers%5B0%5D._meta%5B%22io.modelcontextprotocol.registry%2Fofficial%22%5D.status&label=mcp%20registry&color=blue)](https://registry.modelcontextprotocol.io/v0/servers?search=com.mambabuilt/mcp-youtube-channel-transcript-extractor&limit=1) [![npm version](https://img.shields.io/npm/v/@mambalabsdev/mcp-youtube-channel-transcript-extractor)](https://www.npmjs.com/package/@mambalabsdev/mcp-youtube-channel-transcript-extractor) [![npm downloads](https://img.shields.io/npm/dm/@mambalabsdev/mcp-youtube-channel-transcript-extractor)](https://www.npmjs.com/package/@mambalabsdev/mcp-youtube-channel-transcript-extractor) [![license](https://img.shields.io/github/license/mambalabsdev/mcp-youtube-channel-transcript-extractor)](https://github.com/mambalabsdev/mcp-youtube-channel-transcript-extractor/blob/main/LICENSE)

MCP server for the Mamba Labs **YouTube Channel Stats Extractor** actor on Apify.

Resolve a company domain or YouTube handle to the channel with subscriber count and channel metadata.

## What it does

Resolve a company domain, or a YouTube handle, to that company's YouTube channel. Returns the subscriber count, the stable UC channel id, channel name, creation date and description, as one flat Clay ready row. Subscriber counts are rounded by YouTube above roughly a thousand subscribers, on the page and in its official API alike, and the row flags that. Optional transcript pulling is available and is CURRENTLY GATED by YouTube: the caption track list is readable and the caption content endpoint returns an empty body without a proof of origin token, which the row reports as not_extractable rather than as a video having no captions. No API key needed. Read only; requires an APIFY_TOKEN and consumes Apify credits per call.

## Quick start

Add this to your MCP client configuration:

```json
{
  "mcpServers": {
    "mamba-youtube-channel-stats": {
      "command": "npx",
      "args": ["-y", "@mambalabsdev/mcp-youtube-channel-transcript-extractor"],
      "env": { "APIFY_TOKEN": "your-apify-token" }
    }
  }
}
```

## Prerequisites

- Node.js 18 or newer
- An Apify API token from [console.apify.com/account/integrations](https://console.apify.com/account/integrations)

The actor is pay per event and consumes Apify credits per call. Pricing is on the
[actor page](https://apify.com/mambalabs/youtube-channel-transcript-extractor).

## Example prompts

- "How many YouTube subscribers does stripe.com have?"
- "Find the YouTube channel id for hubspot.com."
- "Does gitlab.com run a YouTube channel, and when was it created?"

## Tool and inputs

Tool: `get_youtube_channel_stats`

| Input | Type | Meaning |
|---|---|---|
| `company_domain` | string | Bare company domain, for example shopify.com. Supply this or a handle. With a domain the actor runs full discovery; with a handle it skips straight to |
| `company_name` | string | Optional. Improves search accuracy and is what the identity gate checks a discovered profile against, so supplying it reduces wrong matches. |
| `handle` | string | Optional. A YouTube handle such as @shopify, or a full channel URL. Supplying it skips discovery and goes straight to the channel. |
| `includeFollowerCounts` | boolean | When "true" (default) the profile page is fetched and the counts are extracted. Set "false" to resolve the profile URL only, which is cheaper and need |
| `skipCache` | boolean | When "false" (default) a successful lookup is cached for seven days and reused. Set "true" to force a fresh fetch. Sent as a string for Clay compatibi |
| `includeTranscripts` | boolean | When "true", full timestamped transcripts are pulled for the most recent videos on the channel and returned as one row per video. Default is "false" b |
| `transcriptVideoCount` | string | How many of the channel's most recent videos to pull transcripts for, when transcripts are on. Default 5. Each video is one extra fetch and one extra  |

## Reading the output

Every row carries a per platform `_status` field, and it is the field to read
first. The vocabulary is the same across the whole Mamba Labs social family:

| Status | Meaning |
|---|---|
| `ok` | fetched and parsed, the value is there |
| `not_found` | we looked and there is no such profile |
| `not_extractable` | the profile exists and the value is not on the wire to us |
| `blocked` | the platform refused us, worth retrying later |
| `identity_mismatch` | we found a real profile and it belongs to someone else |
| `skipped` | you did not ask for this platform |

**`false` and `null` are never interchangeable.** `false` means we looked and the
answer is no. `null` means we could not look. If you filter for companies with no
presence, filter on `false`, because `null` rows are unknown rather than absent.

## Full actor documentation

[apify.com/mambalabs/youtube-channel-transcript-extractor](https://apify.com/mambalabs/youtube-channel-transcript-extractor)

## Mamba Labs GTM Suite

Mamba Labs builds a fleet of GTM enrichment actors that share one flat, Clay
ready output convention, so their rows join on `company_domain` with no cleaning
step. Full fleet: [apify.com/mambalabs](https://apify.com/mambalabs)

## License

MIT
