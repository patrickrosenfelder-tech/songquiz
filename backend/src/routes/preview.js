const express = require('express');
const musicProviderService = require('../services/musicProviders');

const router = express.Router();

// GET /api/preview/search?q=some+song
router.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query param "q" is required' });
  }

  try {
    const { tracks, source, degraded } = await musicProviderService.search(query);
    res.json({ tracks, source, degraded });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/preview/round?q=some+song  -> a single track picked for a game round
router.get('/round', async (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query param "q" is required' });
  }

  try {
    const track = await musicProviderService.getRoundTrack(query);
    res.json(track);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
