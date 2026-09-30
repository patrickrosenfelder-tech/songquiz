const MusicProviderService = require('./MusicProviderService');
const config = require('../../config');

const musicProviderService = new MusicProviderService({
  primaryProviderName: config.primaryMusicProvider,
  timeoutMs: config.musicProviderTimeoutMs,
});

module.exports = musicProviderService;
