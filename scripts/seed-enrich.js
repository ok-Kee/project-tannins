require('dotenv').config();
const Database = require('better-sqlite3');
const Anthropic = require('@anthropic-ai/sdk');

const dbPath = process.env.DB_PATH || './db/tannins.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a professional sommelier. Given a wine or beverage name and its type, provide concise food pairing recommendations. Format your response as brief, practical pairing notes (3-5 pairings) that a restaurant server can quickly read and relay to a guest. Do not include introductory phrases — start directly with the pairings.`;

async function enrichBeverage(bev) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Beverage: ${bev.name}\nType: ${bev.type}\n\nProvide food pairing recommendations.`,
      },
    ],
  });
  return message.content[0].text.trim();
}

async function main() {
  const unenriched = db.prepare(
    "SELECT id, name, type FROM beverages WHERE general_pairing IS NULL OR general_pairing = ''"
  ).all();

  console.log(`Found ${unenriched.length} beverages to enrich`);

  const updatePairing = db.prepare('UPDATE beverages SET general_pairing = ? WHERE id = ?');

  for (let i = 0; i < unenriched.length; i++) {
    const bev = unenriched[i];
    try {
      console.log(`[${i + 1}/${unenriched.length}] Enriching: ${bev.name}`);
      const pairing = await enrichBeverage(bev);
      updatePairing.run(pairing, bev.id);
      // Rate limit: 100ms between calls
      if (i < unenriched.length - 1) await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`  ERROR enriching "${bev.name}":`, err.message);
    }
  }

  console.log('Enrichment complete');
  db.close();
}

main().catch(err => {
  console.error('Enrichment script failed:', err);
  process.exit(1);
});
