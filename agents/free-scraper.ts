// agents/free-scraper.ts
// This scraper uses NO paid APIs. Just raw HTTP + HTML parsing.

import axios from 'axios';
import * as cheerio from 'cheerio';

// Type definition for the scraped pattern
type ScrapedPattern = {
    name: string;
    kickPositions: number[];    // e.g., [1, 3] means kick on beats 1 and 3
    snarePositions: number[];   // e.g., [2, 4]
    hatPattern: number[];       // 16th note grid: 1 = hit, 0 = silence
    bpm?: number;
};

/**
 * Main function: scrapes patterns from a given URL.
 * Change the "selectors" below to match the website you're scraping.
 */
export async function fetchFreePatterns(url: string): Promise<ScrapedPattern[]> {
    try {
        // 1. Fetch the raw HTML
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const html = response.data;

        // 2. Load HTML into Cheerio (like jQuery for Node)
        const $ = cheerio.load(html);

        // 3. Extract patterns (YOU MUST CHANGE THESE SELECTORS)
        //    Right now, this is a TEMPLATE. It looks for elements with class "pattern".
        const patterns: ScrapedPattern[] = [];

        $('.pattern').each((index, element) => {
            const name = $(element).find('.name').text().trim() || `Pattern ${index + 1}`;

            // THIS IS WHERE YOU PARSE THE DATA.
            // Example: if the site shows "Kick: 1, 3" -> parse that text.
            const text = $(element).text();

            // Placeholder parsing logic (YOU NEED TO CUSTOMIZE THIS)
            // For now, it returns dummy data so you can test the structure
            const kicks = text.match(/Kick.*?(\d)/i) ? [1, 3] : [1];
            const snares = text.match(/Snare.*?(\d)/i) ? [2, 4] : [2];

            patterns.push({
                name: name,
                kickPositions: kicks,
                snarePositions: snares,
                hatPattern: [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0], // dummy 16-step
                bpm: undefined
            });
        });

        console.log(`✅ Free scraper found ${patterns.length} patterns.`);
        return patterns;

    } catch (error) {
        console.error("❌ Scraper failed:", error);
        return []; // Return empty array if it fails
    }
}

// --- Optional: Test it directly ---
// Run this file directly to test: npx tsx agents/free-scraper.ts
if (import.meta.url === `file://${process.argv[1]}`) {
    const testUrl = 'https://example.com/midi-patterns'; // CHANGE THIS TO A REAL SITE
    const results = await fetchFreePatterns(testUrl);
    console.log('Scraped Results:', JSON.stringify(results, null, 2));
}