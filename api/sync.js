const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.KV_REST_API_URL) {
    return res.status(503).json({ error: 'Sync not configured — link a Vercel KV database in your project.' });
  }

  const token = (req.method === 'GET'
    ? req.query.token
    : req.body?.token
  )?.trim();

  if (!token || token.length < 10) {
    return res.status(400).json({ error: 'Invalid sync token.' });
  }

  const key = `cv:${token}`;

  if (req.method === 'GET') {
    try {
      const data = await kv.get(key);
      return res.status(200).json(data || { entries: [], chars: [], profile: {} });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { entries, chars, profile } = req.body || {};
      await kv.set(key, {
        entries: entries || [],
        chars: chars || [],
        profile: profile || {},
        updatedAt: new Date().toISOString(),
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
