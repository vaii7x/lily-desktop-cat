// Other apps' windows via Win32 (koffi): their on-screen rects for perching, and the foreground one for
// fullscreen detection. Reads positions only, never titles or contents. If koffi or a DLL fails to load,
// available is false and perching and fullscreen hiding are off.
const { screen } = require('electron');

let api = null;
try {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const dwmapi = koffi.load('dwmapi.dll');
  const RECT = koffi.struct('RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
  const EnumProc = koffi.proto('bool __stdcall EnumWindowsProc(intptr hwnd, intptr lParam)');
  const dwm = (out) => dwmapi.func('__stdcall', 'DwmGetWindowAttribute', 'long', ['intptr', 'uint32', koffi.out(koffi.pointer(out)), 'uint32']);
  api = {
    EnumWindows: user32.func('__stdcall', 'EnumWindows', 'bool', [koffi.pointer(EnumProc), 'intptr']),
    IsWindowVisible: user32.func('bool __stdcall IsWindowVisible(intptr hwnd)'),
    IsIconic: user32.func('bool __stdcall IsIconic(intptr hwnd)'),
    GetWindowRect: user32.func('bool __stdcall GetWindowRect(intptr hwnd, _Out_ RECT *rect)'),
    GetWindowLongPtrW: user32.func('intptr __stdcall GetWindowLongPtrW(intptr hwnd, int index)'),
    GetWindowTextLengthW: user32.func('int __stdcall GetWindowTextLengthW(intptr hwnd)'),
    GetWindowThreadProcessId: user32.func('uint32 __stdcall GetWindowThreadProcessId(intptr hwnd, _Out_ uint32 *pid)'),
    GetShellWindow: user32.func('intptr __stdcall GetShellWindow()'),
    GetForegroundWindow: user32.func('intptr __stdcall GetForegroundWindow()'),
    DwmRect: dwm(RECT),
    DwmFlag: dwm('uint32'),
  };
} catch (err) {
  console.warn('[lily] window tracking unavailable, perching and fullscreen hiding are off:', err.message);
}

const GWL_EXSTYLE = -20;
// Tool windows, no-activate overlays and click-through layers aren't real app windows.
const SKIP_EX = 0x80 | 0x08000000 | 0x20;
const DWMWA_EXTENDED_FRAME_BOUNDS = 9; // the visible frame, without Windows 10/11's invisible resize border
const DWMWA_CLOAKED = 14; // on another virtual desktop, suspended UWP app, and other "visible" ghosts

// {id, rect} in DIP for an app window she could see, else null. Skips the desktop, untitled helper
// windows, and Lily's own windows (they belong to this process).
function info(hwnd) {
  if (!hwnd || !api.IsWindowVisible(hwnd) || api.IsIconic(hwnd) || hwnd === api.GetShellWindow()) return null;
  if (Number(api.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)) & SKIP_EX || !api.GetWindowTextLengthW(hwnd)) return null;
  const flag = [0];
  if (api.DwmFlag(hwnd, DWMWA_CLOAKED, flag, 4) === 0 && flag[0]) return null;
  const pid = [0];
  api.GetWindowThreadProcessId(hwnd, pid);
  if (pid[0] === process.pid) return null;
  const r = {};
  if (api.DwmRect(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, r, 16) !== 0 && !api.GetWindowRect(hwnd, r)) return null;
  const width = r.right - r.left;
  const height = r.bottom - r.top;
  if (width <= 0 || height <= 0) return null;
  return { id: hwnd, rect: screen.screenToDipRect(null, { x: r.left, y: r.top, width, height }) };
}

// App windows in z-order, topmost first.
function list() {
  const out = [];
  api.EnumWindows((hwnd) => {
    const w = info(hwnd);
    if (w) out.push(w);
    return true;
  }, 0);
  return out;
}

const foreground = () => info(api.GetForegroundWindow());

module.exports = { available: api !== null, list, foreground };
