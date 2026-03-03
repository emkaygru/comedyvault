module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = req.headers['x-api-key'] || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(401).json({ error: 'No API key. Add one in Your Story → Settings.' });
  }

  const { type, content, category, title } = req.body || {};
  if (!content) return res.status(400).json({ error: 'No content provided' });

  const PROMPTS = {
    punchup: `You are a comedy punch-up writer. Here's a ${category || 'piece'} called "${title || 'untitled'}":\n\n${content}\n\nMake it funnier, sharper, more specific. Keep their voice authentic — don't sanitize it. Return only the rewrite, no preamble.`,
    expand:  `You're helping a comedian develop material. Here's their seed:\n\n${content}\n\nGive them 5 specific, concrete angles or directions to explore this further. Be a comedy writer, not a life coach. Numbered list.`,
    tiktok:  `Turn this into a TikTok script with a hook in the first 3 seconds:\n\n${content}\n\nFormat:\n🪝 Hook:\n📖 Setup:\n💥 Payoff:\n\nPunchy. Under 60 seconds when read aloud.`,
    prompts: `Based on this content, write 5 specific follow-up questions to help them dig deeper into this story:\n\n${content}\n\nMake them probing and specific — not generic journaling questions. Numbered list only.`,
  };

  const prompt = PROMPTS[type];
  if (!prompt) return res.status(400).json({ error: 'Unknown type' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'Anthropic API error' });
    return res.status(200).json({ result: data.content[0].text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
