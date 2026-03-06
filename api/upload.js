const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'Blob storage not configured. Add BLOB_READ_WRITE_TOKEN in Vercel.' });
  }

  const { filename, contentType, data } = req.body || {};
  if (!data || !filename) return res.status(400).json({ error: 'Missing filename or data.' });
  if (data.length > 6_000_000) return res.status(413).json({ error: 'File too large (max ~4MB).' });

  try {
    const buffer = Buffer.from(data, 'base64');
    const blob = await put(`comedyvault/${filename}`, buffer, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
    });
    return res.status(200).json({ url: blob.url });
  } catch (e) {
    console.error('Blob upload error:', e);
    return res.status(500).json({ error: e.message });
  }
};
