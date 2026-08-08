/**
 * One-time setup: creates the Web Scraper Agent and its environment,
 * then prints the IDs to store in your .env or CI secrets.
 *
 * Usage:
 *   export ANTHROPIC_API_KEY="sk-ant-..."
 *   npx tsx agents/setup.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

async function setup() {
  const environment = await client.beta.environments.create(
    {
      name: "web-scraper-env",
      config: {
        type: "cloud",
        networking: { type: "unrestricted" },
      },
    },
  );
  console.log(`Environment created: ${environment.id}`);

  const agent = await client.beta.agents.create(
    {
      name: "Web Scraper Agent",
      model: "claude-sonnet-4-6",
      system: `You are a web scraping agent that extracts structured data from websites using Browser Use Cloud.

For every scraping request:
1. Infer the target URL and extraction goal from the user message.
2. Call browser_use_extract first to fetch the page content.
3. Call submit_extraction exactly once with the final normalized payload.
4. Keep prose responses concise — the structured tool result is the source of truth.

Rules:
- Use Browser Use for dynamic/SPA pages; do not rely on simple fetch-only logic.
- Never invent values. If a field is unavailable, use null.
- Return data as an array of objects.
- If blocked by login, captcha, or anti-bot flow, explain clearly in the notes field.`,
      tools: [
        { type: "agent_toolset_20260401", default_config: { enabled: true } },
      ],
    },
  );
  console.log(`Agent created: ${agent.id} (version ${agent.version})`);

  console.log("\nStore these in your environment:");
  console.log(`WEB_SCRAPER_AGENT_ID=${agent.id}`);
  console.log(`WEB_SCRAPER_ENV_ID=${environment.id}`);
}

setup().catch(console.error);
