// One shared <audio> element for every song. iOS only lets audio play from an element
// that was started during a tap, so we "unlock" it on the tap that starts a game and then
// reuse it, instead of creating a new element per song (which iOS would block each time).
let audio = null;
let silentUrl = null;

function getAudio() {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
  }
  return audio;
}

// A tiny silent WAV, built once
function silence() {
  if (silentUrl) return silentUrl;
  const sampleRate = 8000;
  const samples = 400;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples * 2, true);
  silentUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  return silentUrl;
}

// Call from a click/tap handler before the game starts
export function unlockAudio() {
  const el = getAudio();
  if (el.dataset.unlocked) return;
  el.src = silence();
  el.play()
    .then(() => {
      el.pause();
      el.dataset.unlocked = 'true';
    })
    .catch(() => {});
}

export function playSong(url, { onPlaying } = {}) {
  const el = getAudio();
  el.onplaying = onPlaying || null;
  el.src = url;
  el.currentTime = 0;
  return el.play();
}

export function stopSong() {
  const el = getAudio();
  el.onplaying = null;
  el.pause();
}
