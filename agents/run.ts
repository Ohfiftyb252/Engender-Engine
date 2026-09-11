/**
 * Runtime: starts a Web Scraper Agent session and streams extraction results.
 *
 * Usage:
 *   export ANTHROPIC_API_KEY="sk-ant-..."
 *   export WEB_SCRAPER_AGENT_ID="agent_01..."
 *   export WEB_SCRAPER_ENV_ID="env_01..."
 *   npx tsx agents/run.ts "https://example.com/products -- extract product names and prices"
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const AGENT_ID = process.env.WEB_SCRAPER_AGENT_ID;
const ENV_ID = process.env.WEB_SCRAPER_ENV_ID;

if (!AGENT_ID || !ENV_ID) {
  console.error("Set WEB_SCRAPER_AGENT_ID and WEB_SCRAPER_ENV_ID env vars.");
  console.error("Run `npx tsx agents/setup.ts` first to create them.");
  process.exit(1);
}

const userMessage = process.argv.slice(2).join(" ") || "https://example.com -- extract the page title and main heading";

async function runScrape(message: string) {
  const session = await client.beta.sessions.create(
    {
      agent: { type: "agent", id: AGENT_ID! },
      environment_id: ENV_ID!,
      title: `Scrape: ${message.slice(0, 60)}`,
    },
  );
  console.log(`Session: ${session.id}`);

  const [events] = await Promise.all([
    streamSession(session.id),
    client.beta.sessions.events.send(
      session.id,
      {
        events: [
          {
            type: "user.message",
            content: [{ type: "text", text: message }],
          },
        ],
      },
    ),
  ]);

  return events;
}

async function streamSession(sessionId: string) {
  const stream = await client.beta.sessions.events.stream(sessionId);

  const output: string[] = [];

  for await (const event of stream) {
    switch (event.type) {
      case "agent.message":
        for (const block of event.content) {
          if (block.type === "text") {
            process.stdout.write(block.text);
            output.push(block.text);
          }
        }
        break;
      case "session.status_idle":
        console.log("\n--- Done ---");
        break;
      case "session.status_terminated":
        console.log("\n--- Session terminated ---");
        break;
    }
  }

  return output.join("");
}

runScrape(userMessage).catch(console.error);
