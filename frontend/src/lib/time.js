// Utility di formattazione tempo condivisi tra i moduli frontend

export function pad2(num) {
    return num.toString().padStart(2, '0');
}

export function formatLocalTimestamp(date) {
    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    const d = pad2(date.getDate());
    const h = pad2(date.getHours());
    const mi = pad2(date.getMinutes());
    const s = pad2(date.getSeconds());
    return `${y}-${m}-${d} ${h}:${mi}:${s}`;
}

export function formatFileTimestamp(date) {
    return formatLocalTimestamp(date).replace(' ', '--').replace(/:/g, '-');
}

// Atteso formato "YYYY-MM-DD HH:MM:SS"
export function parseTimestampString(ts) {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    // Support both "YYYY-MM-DD HH:MM:SS" and ISO-like "YYYY-MM-DDTHH:MM:SS(.sss)[Z]"
    let cleaned = String(ts).trim().replace('T', ' ').replace(/Z$/, '');
    const parts = cleaned.split(' ');
    if (parts.length !== 2) return null;
    const datePart = parts[0];
    let timePart = parts[1];
    const dotIdx = timePart.indexOf('.');
    if (dotIdx !== -1) {
        timePart = timePart.slice(0, dotIdx);
    }
    const dParts = datePart.split('-').map(Number);
    const tParts = timePart.split(':').map(Number);
    if (dParts.length !== 3 || tParts.length !== 3) return null;
    const [year, month, day] = dParts;
    const [hour, minute, second] = tParts;
    if ([year, month, day, hour, minute, second].some(v => Number.isNaN(v))) return null;
    return new Date(year, month - 1, day, hour, minute, second);
}

export function extractTimeLabel(ts) {
    if (!ts) return '';
    if (typeof ts === 'number') {
        const d = new Date(ts);
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    }
    if (typeof ts !== 'string') return '';
    const parts = ts.split(' ');
    if (parts.length !== 2) return ts;
    return parts[1];
}
