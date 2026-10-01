require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 4000,
  primaryMusicProvider: (process.env.PRIMARY_MUSIC_PROVIDER || 'deezer').toLowerCase(),
  musicProviderTimeoutMs: Number(process.env.MUSIC_PROVIDER_TIMEOUT_MS) || 4000,
};
