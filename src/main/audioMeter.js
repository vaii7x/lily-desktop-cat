// How loud the PC is playing right now (0..1), from the default speakers' peak meter (Windows Core Audio via koffi):
// the same level that bounces in the volume mixer. Reads that one number only; no audio is captured or stored.
// If koffi or COM fails, available is false and music reactions are off.
const settings = require('./settings');
const { NO_MUSIC, musicStep } = require('../shared/music');

let api = null;
try {
  const koffi = require('koffi');
  const ole32 = koffi.load('ole32.dll');
  const GUID = koffi.struct('GUID', { d1: 'uint32', d2: 'uint16', d3: 'uint16', d4: koffi.array('uint8', 8) });
  const guid = (s) => {
    const h = s.replace(/-/g, '');
    return { d1: parseInt(h.slice(0, 8), 16), d2: parseInt(h.slice(8, 12), 16), d3: parseInt(h.slice(12, 16), 16),
      d4: [...Array(8)].map((_, i) => parseInt(h.slice(16 + i * 2, 18 + i * 2), 16)) };
  };
  // COM methods: slot n of the object's vtable, called with the object as the first argument.
  const proto = (sig) => koffi.proto(`long __stdcall ${sig}`);
  const method = (obj, slot, type, ...args) => {
    const vtbl = koffi.decode(obj, 'void *');
    return koffi.call(koffi.decode(vtbl, 'void *', slot + 1)[slot], type, obj, ...args);
  };
  const T = {
    release: koffi.proto('uint32 __stdcall Release(void *self)'),
    defaultEndpoint: proto('GetDefaultAudioEndpoint(void *self, int flow, int role, _Out_ void **device)'),
    activate: proto('Activate(void *self, GUID *iid, uint32 ctx, void *params, _Out_ void **out)'),
    peak: proto('GetPeakValue(void *self, _Out_ float *peak)'),
  };
  const CoInitializeEx = ole32.func('long __stdcall CoInitializeEx(void *reserved, uint32 model)');
  const CoCreateInstance = ole32.func('long __stdcall CoCreateInstance(GUID *clsid, void *outer, uint32 ctx, GUID *iid, _Out_ void **out)');
  const CLSCTX_ALL = 0x17;
  CoInitializeEx(null, 2); // apartment-threaded; already initialised (S_FALSE or RPC_E_CHANGED_MODE) is fine
  const out = [null];
  if (CoCreateInstance(guid('BCDE0395-E52F-467C-8E3D-C4579291692E'), null, CLSCTX_ALL, // MMDeviceEnumerator
    guid('A95664D2-9614-4F35-A746-DE8DB63617E6'), out) !== 0) throw new Error('no audio device enumerator'); // IMMDeviceEnumerator
  const enumerator = out[0];
  const IID_METER = guid('C02216F6-8C67-4B5B-9D00-D008E73E0064'); // IAudioMeterInformation
  api = { koffi, T, method, enumerator, IID_METER, CLSCTX_ALL };
} catch (err) {
  console.warn('[lily] audio meter unavailable, music reactions are off:', err.message);
}

let meter = null; // IAudioMeterInformation of the current default speakers
let meterAt = 0;
const REFRESH_MS = 5000; // pick up a new default device (headphones plugged in) this often

function release() {
  if (meter) api.method(meter, 2, api.T.release);
  meter = null;
}

// The default output device's meter; null when there is no output device.
function getMeter(now) {
  if (meter && now - meterAt < REFRESH_MS) return meter;
  release();
  meterAt = now;
  const dev = [null];
  if (api.method(api.enumerator, 4, api.T.defaultEndpoint, 0, 1, dev) !== 0) return null; // eRender, eMultimedia
  const m = [null];
  const hr = api.method(dev[0], 3, api.T.activate, api.IID_METER, api.CLSCTX_ALL, null, m);
  api.method(dev[0], 2, api.T.release);
  if (hr === 0) meter = m[0];
  return meter;
}

// Peak level 0..1 right now, or 0 when it can't be read.
function peak(now = Date.now()) {
  if (!api) return 0;
  try {
    const m = getMeter(now);
    const v = [0];
    if (!m || api.method(m, 3, api.T.peak, v) !== 0) {
      release();
      return 0;
    }
    return v[0];
  } catch (err) {
    release();
    return 0;
  }
}

// Polls the meter while music reactions are on (10 times a second; once a second otherwise, to notice the
// setting) and keeps the "music is playing" state from src/shared/music.js.
let music = NO_MUSIC;

function poll() {
  const on = api !== null && settings.get().musicReactions;
  music = on ? musicStep(music, peak(), Date.now()) : NO_MUSIC;
  setTimeout(poll, on ? 100 : 1000);
}

module.exports = { available: api !== null, peak, start: poll, listening: () => music.on };
