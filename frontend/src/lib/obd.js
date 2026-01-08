// Minimal OBD-II helpers for ELM327-style responses (browser-friendly)

export const PID_MAP = {
  '010C': { name: 'rpm', decode: (a, b) => ((256 * a + b) / 4) },
  '010D': { name: 'speed', decode: (a) => a }, // km/h
  '0105': { name: 'coolant', decode: (a) => a - 40 }, // °C
  '010F': { name: 'intakeTemp', decode: (a) => a - 40 }, // °C
  '0111': { name: 'throttle', decode: (a) => (a * 100) / 255 }, // %
  '0110': { name: 'maf', decode: (a, b) => ((256 * a + b) / 100) }, // g/s
  '0115': { name: 'o2s1Voltage', decode: (a) => a / 200 }, // V
};

export function parseObdResponse(line) {
  const clean = line.replace(/[\r\n>]/g, '').trim();
  if (!clean) return null;

  // Example: "41 0C 1A F8"
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length < 2) return null;
  const modePid = parts[0] + parts[1];
  const pidEntry = PID_MAP[modePid];
  if (!pidEntry) return null;

  const bytes = parts.slice(2).map(p => parseInt(p, 16));
  return { pid: modePid, name: pidEntry.name, value: pidEntry.decode(...bytes) };
}

export function buildPidCommand(pid) {
  return pid.toUpperCase();
}

export const COMMON_PIDS = ['010C', '010D', '0105', '010F', '0111', '0110'];
