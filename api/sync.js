const { sql } = require('@vercel/postgres');

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS cv_sync (
      token      TEXT PRIMARY KEY,
      data       JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.POSTGRES_URL) {
    return res.status(503).json({ error: 'Database not configured.' });
  }

  const token = (req.method === 'GET'
    ? req.query.token
    : req.body?.token
  )?.trim();

  if (!token || token.length < 10) {
    return res.status(400).json({ error: 'Invalid sync token.' });
  }

  try {
    await ensureTable();

    if (req.method === 'GET') {
      const { rows } = await sql`SELECT data FROM cv_sync WHERE token = ${token}`;
      return res.status(200).json(
        rows[0]?.data || { entries: [], chars: [], profile: {} }
      );
    }

    if (req.method === 'POST') {
      const { entries, chars, profile } = req.body || {};
      const data = {
        entries: entries || [],
        chars:   chars   || [],
        profile: profile || {},
        updatedAt: new Date().toISOString(),
      };
      await sql`
        INSERT INTO cv_sync (token, data)
        VALUES (${token}, ${JSON.stringify(data)})
        ON CONFLICT (token) DO UPDATE
          SET data = ${JSON.stringify(data)}, updated_at = NOW()
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('sync error:', e);
    return res.status(500).json({ error: e.message });
  }
};
