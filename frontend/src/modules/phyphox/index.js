import { pad2, formatLocalTimestamp, formatFileTimestamp, parseTimestampString } from '../../lib/time.js';
import { createZipBlob } from '../../lib/zip.js';

const phyphoxConnectButton = document.getElementById('phyphoxConnectButton');
const phyphoxLoadCsvButton = document.getElementById('phyphoxLoadCsvButton');
const phyphoxCsvInput = document.getElementById('phyphoxCsvInput');
const phyphoxDownloadButton = document.getElementById('phyphoxDownloadButton');
const phyphoxMarkerButton = document.getElementById('phyphoxMarkerButton');
const phyphoxStatusEl = document.getElementById('phyphoxStatus');
const phyphoxStatusLed = document.getElementById('phyphoxStatusLed');
const phyphoxBatteryBadge = document.getElementById('phyphoxBatteryBadge');
const phyphoxMetricSelect = document.getElementById('phyphoxMetricSelect');
const phyphoxChartContainer = document.getElementById('phyphoxChartContainer');
const phyphoxChartDropZone = document.getElementById('phyphoxChartDropZone');
const phyphoxChartScroll = document.getElementById('phyphoxChartScroll');
const phyphoxChartScrollInput = document.getElementById('phyphoxChartScrollInput');
const phyphoxMarkerOverlay = document.getElementById('phyphoxMarkerOverlay');
const phyphoxMapEl = document.getElementById('phyphoxMap');
const phyphoxMapZoomInButton = document.getElementById('phyphoxMapZoomIn');
const phyphoxMapZoomOutButton = document.getElementById('phyphoxMapZoomOut');
const phyphoxElapsedTimeEl = document.getElementById('phyphoxElapsedTime');
const phyphoxElapsedLabelEl = document.getElementById('phyphoxElapsedLabel');
const phyphoxConnectionTimeEl = document.getElementById('phyphoxConnectionTime');
const phyphoxAccelCardEl = document.getElementById('phyphoxAccelCard');
const phyphoxGyroCardEl = document.getElementById('phyphoxGyroCard');
const phyphoxModeButtons = document.querySelectorAll('.mode-btn-phyphox');
const phyphoxTelemetryEls = {
    accel: document.getElementById('phyphoxTelemetryAccel'),
    gyro: document.getElementById('phyphoxTelemetryGyro'),
    yaw: document.getElementById('phyphoxTelemetryYaw'),
    pitch: document.getElementById('phyphoxTelemetryPitch'),
    roll: document.getElementById('phyphoxTelemetryRoll'),
    velocity: document.getElementById('phyphoxTelemetryVelocity'),
    height: document.getElementById('phyphoxTelemetryHeight'),
    lat: document.getElementById('phyphoxTelemetryLat'),
    lon: document.getElementById('phyphoxTelemetryLon')
};

const PHYPHOX_WINDOW_POINTS = 120;
const PHYPHOX_SAMPLE_MS = 1000;
const PHYPHOX_REDRAW_MS = 500;
const PHYPHOX_MARKER_COOLDOWN_MS = 15000;
const PHYPHOX_MAX_RECORDS = 20000;
const PHYPHOX_AXIS_FONT = { family: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' };
const PHYPHOX_MARKER_LINE_HEIGHT = 168;
const PHYPHOX_POINT_COLOR = (ctx) => ctx?.dataset?.borderColor || '#0a84ff';

const phyphoxMetricConfig = {
    accelX: {
        label: 'Accel X (m/s²)',
        unit: 'm/s²',
        min: -20,
        max: 20,
        color: '#0a84ff',
        background: 'rgba(10, 132, 255, 0.16)',
        decimals: 2,
        file: 'Accelerometer.csv',
        header: 'X (m/s^2)'
    },
    accelY: {
        label: 'Accel Y (m/s²)',
        unit: 'm/s²',
        min: -20,
        max: 20,
        color: '#5e5ce6',
        background: 'rgba(94, 92, 230, 0.16)',
        decimals: 2,
        file: 'Accelerometer.csv',
        header: 'Y (m/s^2)'
    },
    accelZ: {
        label: 'Accel Z (m/s²)',
        unit: 'm/s²',
        min: -20,
        max: 20,
        color: '#ff9f0a',
        background: 'rgba(255, 159, 10, 0.16)',
        decimals: 2,
        file: 'Accelerometer.csv',
        header: 'Z (m/s^2)'
    },
    linAccX: {
        label: 'Linear Accel X (m/s²)',
        unit: 'm/s²',
        min: -20,
        max: 20,
        color: '#34c759',
        background: 'rgba(52, 199, 89, 0.16)',
        decimals: 2,
        file: 'Linear Accelerometer.csv',
        header: 'X (m/s^2)'
    },
    linAccY: {
        label: 'Linear Accel Y (m/s²)',
        unit: 'm/s²',
        min: -20,
        max: 20,
        color: '#30b0c7',
        background: 'rgba(48, 176, 199, 0.16)',
        decimals: 2,
        file: 'Linear Accelerometer.csv',
        header: 'Y (m/s^2)'
    },
    linAccZ: {
        label: 'Linear Accel Z (m/s²)',
        unit: 'm/s²',
        min: -20,
        max: 20,
        color: '#ff2d55',
        background: 'rgba(255, 45, 85, 0.16)',
        decimals: 2,
        file: 'Linear Accelerometer.csv',
        header: 'Z (m/s^2)'
    },
    gravX: {
        label: 'Gravity X (m/s²)',
        unit: 'm/s²',
        min: -20,
        max: 20,
        color: '#af52de',
        background: 'rgba(175, 82, 222, 0.16)',
        decimals: 2,
        file: 'Gravity.csv',
        header: 'Gravity X (m/s^2)'
    },
    gravY: {
        label: 'Gravity Y (m/s²)',
        unit: 'm/s²',
        min: -20,
        max: 20,
        color: '#5856d6',
        background: 'rgba(88, 86, 214, 0.16)',
        decimals: 2,
        file: 'Gravity.csv',
        header: 'Gravity Y (m/s^2)'
    },
    gravZ: {
        label: 'Gravity Z (m/s²)',
        unit: 'm/s²',
        min: -20,
        max: 20,
        color: '#ff3b30',
        background: 'rgba(255, 59, 48, 0.16)',
        decimals: 2,
        file: 'Gravity.csv',
        header: 'Gravity Z (m/s^2)'
    },
    gyroX: {
        label: 'Gyro X (rad/s)',
        unit: 'rad/s',
        min: -8,
        max: 8,
        color: '#007aff',
        background: 'rgba(0, 122, 255, 0.16)',
        decimals: 3,
        file: 'Gyroscope.csv',
        header: 'X (rad/s)'
    },
    gyroY: {
        label: 'Gyro Y (rad/s)',
        unit: 'rad/s',
        min: -8,
        max: 8,
        color: '#64d2ff',
        background: 'rgba(100, 210, 255, 0.16)',
        decimals: 3,
        file: 'Gyroscope.csv',
        header: 'Y (rad/s)'
    },
    gyroZ: {
        label: 'Gyro Z (rad/s)',
        unit: 'rad/s',
        min: -8,
        max: 8,
        color: '#ffcc00',
        background: 'rgba(255, 204, 0, 0.16)',
        decimals: 3,
        file: 'Gyroscope.csv',
        header: 'Z (rad/s)'
    },
    yaw: {
        label: 'Yaw (°)',
        unit: '°',
        min: -180,
        max: 180,
        color: '#ff9500',
        background: 'rgba(255, 149, 0, 0.16)',
        decimals: 2,
        file: 'Orientation.csv',
        header: 'Yaw (°)'
    },
    pitch: {
        label: 'Pitch (°)',
        unit: '°',
        min: -180,
        max: 180,
        color: '#34c759',
        background: 'rgba(52, 199, 89, 0.16)',
        decimals: 2,
        file: 'Orientation.csv',
        header: 'Pitch (°)'
    },
    roll: {
        label: 'Roll (°)',
        unit: '°',
        min: -180,
        max: 180,
        color: '#ff2d55',
        background: 'rgba(255, 45, 85, 0.16)',
        decimals: 2,
        file: 'Orientation.csv',
        header: 'Roll (°)'
    },
    direct: {
        label: 'Direct (°)',
        unit: '°',
        min: 0,
        max: 360,
        color: '#5e5ce6',
        background: 'rgba(94, 92, 230, 0.16)',
        decimals: 2,
        file: 'Orientation.csv',
        header: 'Direct (°)'
    },
    velocity: {
        label: 'Velocity (m/s)',
        unit: 'm/s',
        min: 0,
        max: 50,
        color: '#30b0c7',
        background: 'rgba(48, 176, 199, 0.16)',
        decimals: 2,
        file: 'Location.csv',
        header: 'Velocity (m/s)'
    },
    height: {
        label: 'Height (m)',
        unit: 'm',
        min: 0,
        max: 2000,
        color: '#8e8e93',
        background: 'rgba(142, 142, 147, 0.16)',
        decimals: 2,
        file: 'Location.csv',
        header: 'Height (m)'
    },
    lat: {
        label: 'Latitude (°)',
        unit: '°',
        min: -90,
        max: 90,
        color: '#00c7be',
        background: 'rgba(0, 199, 190, 0.16)',
        decimals: 6,
        file: 'Location.csv',
        header: 'Latitude (°)'
    },
    lon: {
        label: 'Longitude (°)',
        unit: '°',
        min: -180,
        max: 180,
        color: '#bf5af2',
        background: 'rgba(191, 90, 242, 0.16)',
        decimals: 6,
        file: 'Location.csv',
        header: 'Longitude (°)'
    }
};

const phyphoxMetricOrder = Object.keys(phyphoxMetricConfig);
const phyphoxFileMetricMap = Object.entries(phyphoxMetricConfig).reduce((acc, [key, cfg]) => {
    if (!cfg?.file || !cfg?.header) return acc;
    const fileKey = normalizeFileName(cfg.file);
    if (!fileKey) return acc;
    if (!acc[fileKey]) acc[fileKey] = [];
    acc[fileKey].push({ key, header: cfg.header });
    return acc;
}, {});

let phyphoxChart = null;
let phyphoxMode = 'live';
let phyphoxRecordedData = [];
let phyphoxConnectionStartTime = null;
let phyphoxConnectionTimerId = null;
let phyphoxSimTimer = null;
let phyphoxSimState = null;
let phyphoxChartControlsEnabled = false;
let phyphoxDebugWindowStart = 0;
let phyphoxMarkers = [];
let phyphoxMarkerCounter = 1;
let phyphoxMarkerCooldownTimer = null;
let phyphoxMarkerActive = true;
let phyphoxMarkerPoints = [];
let phyphoxSessionCounter = 1;
let phyphoxLastRedrawTs = 0;
let phyphoxLatestValues = {};
let phyphoxMap = null;
let phyphoxMapPath = null;
let phyphoxMapMarker = null;
let phyphoxMapPoints = [];
const phyphoxData = {
    metric: 'accelX'
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function jitter(value, amount) {
    return value + (Math.random() * 2 - 1) * amount;
}

function normalizeHeaderName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseCsvNumber(value) {
    if (value == null) return null;
    let str = String(value).trim();
    if (!str) return null;
    if (str.includes(',') && !str.includes('.')) {
        str = str.replace(',', '.');
    }
    const num = Number(str);
    if (!Number.isFinite(num)) return null;
    return num;
}

function splitCsvLine(line, delimiter = ',') {
    const out = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (ch === delimiter && !inQuotes) {
            out.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    out.push(current);
    return out;
}

function detectCsvDelimiter(line) {
    const commaCount = (line.match(/,/g) || []).length;
    const semiCount = (line.match(/;/g) || []).length;
    return semiCount > commaCount ? ';' : ',';
}

function normalizeCsvContent(text) {
    let content = String(text || '');
    content = content.replace(/\u0000/g, '');
    if (!content.trim()) return '';
    if (!content.includes('\n') && !content.includes('\r') && (content.includes('\\n') || content.includes('\\r'))) {
        content = content.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
    }
    return content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u2028\u2029\u0085\u000b\u000c\u001e]/g, '\n');
}

function parseCsvHeader(lines) {
    const headerLine = lines[0].replace(/^\uFEFF/, '');
    const delimiter = detectCsvDelimiter(headerLine);
    const header = splitCsvLine(headerLine, delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    const headerLower = header.map(normalizeHeaderName);
    const headerMap = new Map();
    headerLower.forEach((name, idx) => headerMap.set(name, idx));
    return { delimiter, header, headerLower, headerMap };
}

function findHeaderIndex(headerMap, names) {
    for (const name of names) {
        if (!name) continue;
        const idx = headerMap.get(normalizeHeaderName(name));
        if (idx != null) return idx;
    }
    return -1;
}

function parsePhyphoxTimeString(value) {
    if (!value) return null;
    const match = String(value).trim().match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if (!match) return null;
    const now = new Date();
    const [, h, m, s, ms] = match;
    const millis = ms ? Number(ms.padEnd(3, '0')) : 0;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(h), Number(m), Number(s), millis).getTime();
}

function formatPhyphoxFullTimestamp(rawTs, tsNum) {
    const parsed = parseTimestampString(rawTs);
    if (parsed) return formatLocalTimestamp(parsed);
    return formatLocalTimestamp(new Date(tsNum));
}

function normalizePhyphoxTimestamp(rawTs) {
    if (rawTs == null) return Date.now();
    if (rawTs instanceof Date) return rawTs.getTime();
    if (typeof rawTs === 'string') {
        const parsed = parseTimestampString(rawTs);
        if (parsed) return parsed.getTime();
        const parsedTime = parsePhyphoxTimeString(rawTs);
        if (parsedTime != null) return parsedTime;
    }
    const num = Number(rawTs);
    if (!Number.isFinite(num)) return Date.now();
    if (num > 1e13) return Math.floor(num / 1000);
    if (num < 1e11) return Math.floor(num * 1000);
    return num;
}

function formatPhyphoxDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function formatPhyphoxTimeLabel(rawTs, tsNum) {
    if (typeof rawTs === 'string') {
        const match = rawTs.match(/^(\d{1,2}:\d{2}:\d{2})/);
        if (match) return match[1];
    }
    const d = new Date(tsNum);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function slugifyLabel(label) {
    return String(label || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeFileName(name) {
    return String(name || '').split('/').pop().toLowerCase();
}

function getNextPhyphoxSessionId() {
    return pad2(phyphoxSessionCounter++);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function setPhyphoxStatus(connected) {
    if (phyphoxMode === 'debug') {
        if (phyphoxStatusLed) phyphoxStatusLed.classList.remove('connected');
        if (phyphoxStatusEl) phyphoxStatusEl.textContent = 'Modalità debug';
        if (phyphoxConnectButton) {
            phyphoxConnectButton.textContent = 'Connetti';
            phyphoxConnectButton.classList.remove('disconnect');
        }
        return;
    }
    if (phyphoxStatusLed) phyphoxStatusLed.classList.toggle('connected', connected);
    if (phyphoxStatusEl) phyphoxStatusEl.textContent = connected ? 'Connesso' : 'Non connesso';
    if (phyphoxConnectButton) {
        phyphoxConnectButton.textContent = connected ? 'Disconnetti' : 'Connetti';
        phyphoxConnectButton.classList.toggle('disconnect', connected);
    }
}

function updatePhyphoxBattery(level) {
    if (!phyphoxBatteryBadge) return;
    phyphoxBatteryBadge.textContent = (level != null && !Number.isNaN(level)) ? `${level}%` : '--%';
}

function updatePhyphoxElapsedTime() {
    if (!phyphoxConnectionStartTime || !phyphoxElapsedTimeEl) return;
    const now = new Date();
    const diffMs = now - phyphoxConnectionStartTime;
    phyphoxElapsedTimeEl.textContent = formatPhyphoxDuration(diffMs);
}

function resetPhyphoxTelemetry() {
    phyphoxLatestValues = {};
    Object.values(phyphoxTelemetryEls).forEach((el) => {
        if (el) el.textContent = '--';
    });
}

function formatTelemetryValue(value, decimals = 2) {
    if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return '--';
    return value.toFixed(decimals);
}

function getVectorMagnitude(x, y, z) {
    if ([x, y, z].some(v => v == null || Number.isNaN(v))) return null;
    return Math.sqrt(x * x + y * y + z * z);
}

function isValidLatLon(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function setPhyphoxMapControlsEnabled(enabled) {
    const buttons = [phyphoxMapZoomInButton, phyphoxMapZoomOutButton];
    buttons.forEach((btn) => {
        if (!btn) return;
        btn.disabled = !enabled;
        btn.classList.toggle('disabled', !enabled);
        btn.setAttribute('aria-disabled', (!enabled).toString());
    });
}

function initPhyphoxMap() {
    if (!phyphoxMapEl) return;
    if (!window.L) {
        phyphoxMapEl.textContent = 'Mappa non disponibile.';
        setPhyphoxMapControlsEnabled(false);
        return;
    }
    phyphoxMap = window.L.map(phyphoxMapEl, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false,
        renderer: window.L.svg()
    });
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO'
    }).addTo(phyphoxMap);
    phyphoxMap.setView([45.4642, 9.19], 15);
    phyphoxMapPath = window.L.polyline([], {
        color: '#0a84ff',
        weight: 5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(phyphoxMap);
    setPhyphoxMapControlsEnabled(true);
    setTimeout(() => {
        phyphoxMap?.invalidateSize();
    }, 0);
}

function resetPhyphoxMap() {
    phyphoxMapPoints = [];
    if (phyphoxMapPath) phyphoxMapPath.setLatLngs([]);
    if (phyphoxMapMarker && phyphoxMap) {
        phyphoxMap.removeLayer(phyphoxMapMarker);
    }
    phyphoxMapMarker = null;
}

function appendPhyphoxMapPoint(lat, lon, options = {}) {
    if (!phyphoxMap || !phyphoxMapPath) return;
    if (!isValidLatLon(lat, lon)) return;
    const point = [lat, lon];
    const last = phyphoxMapPoints[phyphoxMapPoints.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) return;
    phyphoxMapPoints.push(point);
    phyphoxMapPath.setLatLngs(phyphoxMapPoints);
    if (!phyphoxMapMarker) {
        phyphoxMapMarker = window.L.circleMarker(point, {
            radius: 4,
            color: '#0a84ff',
            fillColor: '#0a84ff',
            opacity: 0.6,
            fillOpacity: 0.35
        }).addTo(phyphoxMap);
    } else {
        phyphoxMapMarker.setLatLng(point);
    }
    if (options.fit) {
        if (phyphoxMapPoints.length > 1) {
            phyphoxMap.fitBounds(phyphoxMapPath.getBounds(), { padding: [24, 24], animate: false });
        } else {
            phyphoxMap.setView(point, 16, { animate: false });
        }
    } else {
        phyphoxMap.panTo(point, { animate: false });
    }
}

function rebuildPhyphoxMapFromRows(rows) {
    if (!phyphoxMap || !phyphoxMapPath) return;
    resetPhyphoxMap();
    rows.forEach((row) => {
        const lat = row?.values?.lat;
        const lon = row?.values?.lon;
        if (isValidLatLon(lat, lon)) {
            phyphoxMapPoints.push([lat, lon]);
        }
    });
    phyphoxMapPath.setLatLngs(phyphoxMapPoints);
    if (phyphoxMapPoints.length) {
        const last = phyphoxMapPoints[phyphoxMapPoints.length - 1];
        phyphoxMapMarker = window.L.circleMarker(last, {
            radius: 4,
            color: '#0a84ff',
            fillColor: '#0a84ff',
            opacity: 0.6,
            fillOpacity: 0.35
        }).addTo(phyphoxMap);
        if (phyphoxMapPoints.length > 1) {
            phyphoxMap.fitBounds(phyphoxMapPath.getBounds(), { padding: [24, 24], animate: false });
        } else {
            phyphoxMap.setView(last, 16, { animate: false });
        }
    }
}

function updatePhyphoxLatest(values = {}) {
    Object.entries(values).forEach(([key, value]) => {
        if (value == null || Number.isNaN(value)) return;
        phyphoxLatestValues[key] = value;
    });
}

function updatePhyphoxCardsFromLatest() {
    const accelMag = getVectorMagnitude(
        phyphoxLatestValues.linAccX ?? phyphoxLatestValues.accelX,
        phyphoxLatestValues.linAccY ?? phyphoxLatestValues.accelY,
        phyphoxLatestValues.linAccZ ?? phyphoxLatestValues.accelZ
    );
    const gyroMag = getVectorMagnitude(
        phyphoxLatestValues.gyroX,
        phyphoxLatestValues.gyroY,
        phyphoxLatestValues.gyroZ
    );
    if (phyphoxAccelCardEl) phyphoxAccelCardEl.textContent = formatTelemetryValue(accelMag, 2);
    if (phyphoxGyroCardEl) phyphoxGyroCardEl.textContent = formatTelemetryValue(gyroMag, 2);
}

function updatePhyphoxTelemetry() {
    const accelMag = getVectorMagnitude(
        phyphoxLatestValues.linAccX ?? phyphoxLatestValues.accelX,
        phyphoxLatestValues.linAccY ?? phyphoxLatestValues.accelY,
        phyphoxLatestValues.linAccZ ?? phyphoxLatestValues.accelZ
    );
    const gyroMag = getVectorMagnitude(
        phyphoxLatestValues.gyroX,
        phyphoxLatestValues.gyroY,
        phyphoxLatestValues.gyroZ
    );
    if (phyphoxTelemetryEls.accel) phyphoxTelemetryEls.accel.textContent = formatTelemetryValue(accelMag, 2);
    if (phyphoxTelemetryEls.gyro) phyphoxTelemetryEls.gyro.textContent = formatTelemetryValue(gyroMag, 2);
    if (phyphoxTelemetryEls.yaw) phyphoxTelemetryEls.yaw.textContent = formatTelemetryValue(phyphoxLatestValues.yaw, 2);
    if (phyphoxTelemetryEls.pitch) phyphoxTelemetryEls.pitch.textContent = formatTelemetryValue(phyphoxLatestValues.pitch, 2);
    if (phyphoxTelemetryEls.roll) phyphoxTelemetryEls.roll.textContent = formatTelemetryValue(phyphoxLatestValues.roll, 2);
    if (phyphoxTelemetryEls.velocity) phyphoxTelemetryEls.velocity.textContent = formatTelemetryValue(phyphoxLatestValues.velocity, 2);
    if (phyphoxTelemetryEls.height) phyphoxTelemetryEls.height.textContent = formatTelemetryValue(phyphoxLatestValues.height, 2);
    if (phyphoxTelemetryEls.lat) phyphoxTelemetryEls.lat.textContent = formatTelemetryValue(phyphoxLatestValues.lat, 6);
    if (phyphoxTelemetryEls.lon) phyphoxTelemetryEls.lon.textContent = formatTelemetryValue(phyphoxLatestValues.lon, 6);
}

function applyPhyphoxMarkerState() {
    if (!phyphoxMarkerButton) return;
    const enabled = phyphoxChartControlsEnabled && phyphoxMarkerActive;
    phyphoxMarkerButton.disabled = !enabled;
    phyphoxMarkerButton.classList.toggle('disabled', !enabled);
    phyphoxMarkerButton.setAttribute('aria-disabled', (!enabled).toString());
}

function setPhyphoxChartControlsEnabled(enabled) {
    phyphoxChartControlsEnabled = enabled;
    const iconButtons = [phyphoxDownloadButton, phyphoxMarkerButton];
    iconButtons.forEach((btn) => {
        if (!btn) return;
        btn.disabled = !enabled;
        btn.classList.toggle('disabled', !enabled);
        btn.setAttribute('aria-disabled', (!enabled).toString());
    });
    if (phyphoxMetricSelect) {
        phyphoxMetricSelect.disabled = !enabled;
        phyphoxMetricSelect.classList.toggle('disabled', !enabled);
        phyphoxMetricSelect.setAttribute('aria-disabled', (!enabled).toString());
    }
    if (phyphoxChartScrollInput) {
        phyphoxChartScrollInput.disabled = !enabled;
    }
    if (!enabled) {
        if (phyphoxMarkerCooldownTimer) clearTimeout(phyphoxMarkerCooldownTimer);
        phyphoxMarkerCooldownTimer = null;
        phyphoxMarkerActive = true;
    }
    applyPhyphoxMarkerState();
}

function startPhyphoxMarkerCooldown() {
    phyphoxMarkerActive = false;
    if (phyphoxMarkerCooldownTimer) clearTimeout(phyphoxMarkerCooldownTimer);
    phyphoxMarkerCooldownTimer = setTimeout(() => {
        phyphoxMarkerCooldownTimer = null;
        phyphoxMarkerActive = true;
        applyPhyphoxMarkerState();
    }, PHYPHOX_MARKER_COOLDOWN_MS);
    applyPhyphoxMarkerState();
}

function ensurePhyphoxDebugMode() {
    if (phyphoxMode === 'debug') return true;
    setPhyphoxMode('debug');
    return phyphoxMode === 'debug';
}

function resetPhyphoxValues() {
    if (phyphoxAccelCardEl) phyphoxAccelCardEl.textContent = '--';
    if (phyphoxGyroCardEl) phyphoxGyroCardEl.textContent = '--';
    updatePhyphoxBattery(null);
    resetPhyphoxTelemetry();
}

function clearPhyphoxData() {
    phyphoxRecordedData = [];
    phyphoxMarkers = [];
    phyphoxMarkerCounter = 1;
    phyphoxMarkerPoints = [];
    phyphoxDebugWindowStart = 0;
    resetPhyphoxValues();
    resetPhyphoxMap();
    if (phyphoxChart) {
        phyphoxChart.data.labels = [];
        phyphoxChart.data.datasets[0].data = [];
        phyphoxChart.update('none');
    }
}

function initPhyphoxChart() {
    const ctxPhyphox = document.getElementById('phyphoxChart').getContext('2d');
    const cfg = phyphoxMetricConfig[phyphoxData.metric];
    phyphoxChart = new Chart(ctxPhyphox, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: cfg?.label || 'Accel X (m/s²)',
                data: [],
                borderColor: cfg?.color || '#0a84ff',
                pointBorderColor: PHYPHOX_POINT_COLOR,
                pointBackgroundColor: PHYPHOX_POINT_COLOR,
                pointHoverBorderColor: PHYPHOX_POINT_COLOR,
                pointHoverBackgroundColor: PHYPHOX_POINT_COLOR,
                backgroundColor: cfg?.background || 'rgba(10, 132, 255, 0.16)',
                borderWidth: 2,
                tension: 0.1,
                spanGaps: true,
                pointRadius: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 16,
                    right: 8,
                    left: 8,
                    bottom: 8
                }
            },
            scales: {
                x: {
                    display: true,
                    position: 'bottom',
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: {
                        color: 'rgba(60,60,67,0.7)',
                        font: PHYPHOX_AXIS_FONT,
                        autoSkip: true,
                        maxTicksLimit: 6
                    },
                    title: { display: true, text: 'Tempo (HH:MM:SS)', color: 'rgba(60,60,67,0.7)' }
                },
                y: {
                    display: true,
                    position: 'left',
                    min: cfg?.min ?? 0,
                    max: cfg?.max ?? 100,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: {
                        color: 'rgba(60,60,67,0.7)',
                        font: PHYPHOX_AXIS_FONT
                    },
                    title: { display: true, text: cfg?.label || 'Accel X (m/s²)', color: 'rgba(60,60,67,0.7)' }
                }
            },
            elements: {
                point: {
                    backgroundColor: PHYPHOX_POINT_COLOR,
                    borderColor: PHYPHOX_POINT_COLOR
                }
            },
            plugins: { legend: { display: false } },
            animation: false
        }
    });
}

function updatePhyphoxChartStyle(metricKey) {
    if (!phyphoxChart) return;
    const cfg = phyphoxMetricConfig[metricKey];
    if (!cfg) return;
    phyphoxChart.data.datasets[0].borderColor = cfg.color;
    phyphoxChart.data.datasets[0].pointBorderColor = PHYPHOX_POINT_COLOR;
    phyphoxChart.data.datasets[0].pointBackgroundColor = PHYPHOX_POINT_COLOR;
    phyphoxChart.data.datasets[0].pointHoverBorderColor = PHYPHOX_POINT_COLOR;
    phyphoxChart.data.datasets[0].pointHoverBackgroundColor = PHYPHOX_POINT_COLOR;
    phyphoxChart.data.datasets[0].backgroundColor = cfg.background;
    phyphoxChart.data.datasets[0].label = cfg.label;
    phyphoxChart.data.datasets[0].spanGaps = true;
    if (phyphoxChart.options?.scales?.y?.title) {
        const yLabel = cfg.unit ? `${cfg.label}` : cfg.label;
        phyphoxChart.options.scales.y.title.text = yLabel;
    }
    phyphoxChart.options.scales.y.min = cfg.min;
    phyphoxChart.options.scales.y.max = cfg.max;
    if (!phyphoxChart.options.elements) phyphoxChart.options.elements = {};
    phyphoxChart.options.elements.point = {
        ...(phyphoxChart.options.elements.point || {}),
        backgroundColor: PHYPHOX_POINT_COLOR,
        borderColor: PHYPHOX_POINT_COLOR
    };
}

function getPhyphoxWindowMeta() {
    const windowSize = PHYPHOX_WINDOW_POINTS;
    const maxStart = Math.max(0, phyphoxRecordedData.length - windowSize);
    const startIndex = (phyphoxMode === 'debug')
        ? Math.min(phyphoxDebugWindowStart, maxStart)
        : Math.max(0, maxStart);
    return {
        rows: phyphoxRecordedData.slice(startIndex, startIndex + windowSize),
        startIndex
    };
}

function updatePhyphoxChartScrollState() {
    if (!phyphoxChartScroll || !phyphoxChartScrollInput) return;
    if (phyphoxMode !== 'debug') {
        phyphoxChartScroll.hidden = true;
        phyphoxDebugWindowStart = 0;
        return;
    }
    const maxStart = Math.max(0, phyphoxRecordedData.length - PHYPHOX_WINDOW_POINTS);
    const shouldShow = maxStart > 0;
    phyphoxChartScroll.hidden = !shouldShow;
    if (!shouldShow) {
        phyphoxDebugWindowStart = 0;
        return;
    }
    if (phyphoxDebugWindowStart > maxStart) phyphoxDebugWindowStart = maxStart;
    phyphoxChartScrollInput.min = '0';
    phyphoxChartScrollInput.max = `${maxStart}`;
    phyphoxChartScrollInput.step = '1';
    phyphoxChartScrollInput.value = `${phyphoxDebugWindowStart}`;
}

function recordPhyphoxSample(values, timestamp) {
    const tsNum = normalizePhyphoxTimestamp(timestamp);
    const tsLabel = formatPhyphoxTimeLabel(timestamp, tsNum);
    const tsFull = formatLocalTimestamp(new Date(tsNum));
    const row = {
        timestamp: tsNum,
        timestampLabel: tsLabel,
        timestampFull: tsFull,
        values: { ...values }
    };
    phyphoxRecordedData.push(row);
    if (phyphoxMode !== 'debug' && phyphoxRecordedData.length > PHYPHOX_MAX_RECORDS) {
        phyphoxRecordedData.shift();
    }
    updatePhyphoxLatest(values);
    updatePhyphoxCardsFromLatest();
    updatePhyphoxTelemetry();
    appendPhyphoxMapPoint(values?.lat, values?.lon);

    const nowTs = Date.now();
    if (nowTs - phyphoxLastRedrawTs >= PHYPHOX_REDRAW_MS) {
        phyphoxLastRedrawTs = nowTs;
        redrawPhyphoxChart();
    }
}

function redrawPhyphoxChart() {
    if (!phyphoxChart) return;
    const { rows } = getPhyphoxWindowMeta();
    const labels = [];
    const values = [];
    rows.forEach((row) => {
        const v = row.values?.[phyphoxData.metric];
        labels.push(row.timestampLabel || formatPhyphoxTimeLabel(row.timestamp, row.timestamp));
        values.push(v != null && !Number.isNaN(v) ? v : null);
    });
    phyphoxChart.data.labels = labels;
    phyphoxChart.data.datasets[0].data = values;
    updatePhyphoxChartStyle(phyphoxData.metric);
    const cfg = phyphoxMetricConfig[phyphoxData.metric];
    if (cfg) {
        const pointColors = values.map(() => cfg.color);
        phyphoxChart.data.datasets[0].pointBackgroundColor = pointColors;
        phyphoxChart.data.datasets[0].pointBorderColor = pointColors;
        phyphoxChart.data.datasets[0].pointHoverBackgroundColor = pointColors;
        phyphoxChart.data.datasets[0].pointHoverBorderColor = pointColors;
    }
    phyphoxChart.update('none');
    updatePhyphoxChartScrollState();
    rebuildPhyphoxMarkersDataset();
}

function rebuildPhyphoxMarkersDataset() {
    if (!phyphoxChart || !phyphoxMarkerOverlay) return;
    phyphoxMarkerPoints = [];
    const { rows } = getPhyphoxWindowMeta();
    const rowMarkerLabels = new Set();
    rows.forEach((row, idx) => {
        if (row && row.marker != null && row.marker !== '') {
            phyphoxMarkerPoints.push({ xIndex: idx, marker: row.marker });
            rowMarkerLabels.add(String(row.marker));
        }
    });
    const extraMarkers = phyphoxMarkers.filter(marker => !rowMarkerLabels.has(String(marker?.label)));
    if (extraMarkers.length) {
        let minTs = Infinity;
        let maxTs = -Infinity;
        rows.forEach((row) => {
            const ts = Number(row?.timestamp);
            if (!Number.isFinite(ts)) return;
            if (ts < minTs) minTs = ts;
            if (ts > maxTs) maxTs = ts;
        });
        extraMarkers.forEach((marker) => {
            const ts = Number(marker?.timestamp);
            if (!Number.isFinite(ts)) return;
            if (ts < minTs || ts > maxTs) return;
            let bestIdx = -1;
            let bestDiff = Infinity;
            for (let i = 0; i < rows.length; i++) {
                const rowTs = Number(rows[i]?.timestamp);
                if (!Number.isFinite(rowTs)) continue;
                const diff = Math.abs(rowTs - ts);
                if (diff < bestDiff || (diff === bestDiff && i > bestIdx)) {
                    bestDiff = diff;
                    bestIdx = i;
                }
            }
            if (bestIdx >= 0) {
                phyphoxMarkerPoints.push({ xIndex: bestIdx, marker: marker.label });
            }
        });
    }
    requestAnimationFrame(drawPhyphoxMarkerOverlay);
}

function drawPhyphoxMarkerOverlay() {
    if (!phyphoxMarkerOverlay || !phyphoxChart || !phyphoxChart.scales?.x || !phyphoxChart.scales?.y) return;
    const xScale = phyphoxChart.scales.x;
    const yScale = phyphoxChart.scales.y;
    const chartArea = phyphoxChart.chartArea;
    const rect = phyphoxChart.canvas.getBoundingClientRect();
    const containerRect = phyphoxChartContainer?.getBoundingClientRect();
    const offsetX = containerRect ? rect.left - containerRect.left : 0;
    const offsetY = containerRect ? rect.top - containerRect.top : 0;
    const dpr = window.devicePixelRatio || 1;
    const canvasScale = rect.width ? (phyphoxChart.canvas.width / rect.width) : dpr;
    const chartMaxRight = chartArea?.right ?? xScale.right ?? 0;
    const needsScale = rect.width > 0 && chartMaxRight > rect.width + 1;
    const toCss = (v) => (needsScale ? (v / canvasScale) : v);
    phyphoxMarkerOverlay.width = rect.width * dpr;
    phyphoxMarkerOverlay.height = rect.height * dpr;
    phyphoxMarkerOverlay.style.width = `${rect.width}px`;
    phyphoxMarkerOverlay.style.height = `${rect.height}px`;
    phyphoxMarkerOverlay.style.left = `${offsetX}px`;
    phyphoxMarkerOverlay.style.top = `${offsetY}px`;
    const ctx = phyphoxMarkerOverlay.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!phyphoxMarkerPoints.length) {
        ctx.restore();
        return;
    }
    const left = toCss(Number.isFinite(xScale.left) ? xScale.left : (chartArea?.left ?? 0));
    const right = toCss(Number.isFinite(xScale.right) ? xScale.right : (chartArea?.right ?? rect.width));
    const yTop = toCss(Number.isFinite(yScale.top) ? yScale.top : (chartArea?.top ?? 0));
    const markerHeight = (() => {
        if (!phyphoxChartContainer) return PHYPHOX_MARKER_LINE_HEIGHT;
        const raw = getComputedStyle(phyphoxChartContainer).getPropertyValue('--phyphox-marker-line-height');
        const parsed = Number.parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : PHYPHOX_MARKER_LINE_HEIGHT;
    })();
    const yBottom = Math.min(yTop + markerHeight, rect.height);
    if (right > left && yBottom > yTop) {
        ctx.beginPath();
        ctx.rect(left, yTop, right - left, yBottom - yTop);
        ctx.clip();
    }
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = '#ff9f0a';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#ff9f0a';
    phyphoxMarkerPoints.forEach((pt) => {
        if (!pt || pt.xIndex == null) return;
        const x = toCss(xScale.getPixelForValue(pt.xIndex));
        ctx.beginPath();
        ctx.moveTo(x, yTop);
        ctx.lineTo(x, yBottom);
        ctx.stroke();
        const triH = 10;
        const triW = 12;
        ctx.beginPath();
        ctx.moveTo(x, yTop + triH);
        ctx.lineTo(x - triW / 2, yTop);
        ctx.lineTo(x + triW / 2, yTop);
        ctx.closePath();
        ctx.fill();
    });
    ctx.restore();
}

function addPhyphoxMarker() {
    if (!phyphoxChart || !phyphoxRecordedData.length) {
        alert('Nessun dato disponibile per inserire un marker.');
        return;
    }
    const { rows, startIndex } = getPhyphoxWindowMeta();
    if (!rows.length) {
        alert('Nessun dato disponibile per inserire un marker.');
        return;
    }
    let targetIndex = -1;
    for (let i = rows.length - 1; i >= 0; i--) {
        const val = rows[i]?.values?.[phyphoxData.metric];
        if (val != null && !Number.isNaN(val)) {
            targetIndex = i;
            break;
        }
    }
    if (targetIndex === -1) targetIndex = rows.length - 1;
    const globalIdx = startIndex + targetIndex;
    const row = phyphoxRecordedData[globalIdx];
    if (!row) {
        alert('Nessun dato disponibile per inserire un marker.');
        return;
    }
    const label = phyphoxMarkerCounter++;
    row.marker = label;
    phyphoxMarkers.push({ timestamp: row.timestamp, label });
    rebuildPhyphoxMarkersDataset();
}

function showAllPhyphoxMetricOptions() {
    if (!phyphoxMetricSelect) return;
    Array.from(phyphoxMetricSelect.options).forEach(opt => {
        opt.hidden = false;
        opt.disabled = false;
    });
}

function setPhyphoxMetricOptionsVisibilityForDebug(options = {}) {
    const { preferred = null, forceFirst = false } = options;
    if (!phyphoxMetricSelect) return;
    if (phyphoxMode !== 'debug' || !phyphoxRecordedData.length) {
        showAllPhyphoxMetricOptions();
        return;
    }
    const availability = {};
    phyphoxMetricOrder.forEach((key) => {
        availability[key] = false;
    });
    phyphoxRecordedData.forEach((row) => {
        if (!row?.values) return;
        Object.keys(row.values).forEach((key) => {
            if (row.values[key] != null && !Number.isNaN(row.values[key])) {
                availability[key] = true;
            }
        });
    });

    let firstAvailable = null;
    Array.from(phyphoxMetricSelect.options).forEach((opt) => {
        const available = availability[opt.value] !== false;
        opt.hidden = !available;
        opt.disabled = !available;
        if (available && !firstAvailable) firstAvailable = opt.value;
    });

    const selectedOption = Array.from(phyphoxMetricSelect.options).find(opt => opt.value === phyphoxMetricSelect.value);
    const selectedAvailable = selectedOption ? !selectedOption.disabled : false;
    let target = null;
    if (preferred && availability[preferred] !== false) {
        target = preferred;
    } else if (forceFirst || !selectedAvailable) {
        target = firstAvailable;
    }
    if (target && target !== phyphoxData.metric) {
        phyphoxData.metric = target;
        if (phyphoxMetricSelect) phyphoxMetricSelect.value = target;
        redrawPhyphoxChart();
    }
}

function startPhyphoxSimulation() {
    if (phyphoxSimTimer) clearInterval(phyphoxSimTimer);
    const baseLat = 45.4642;
    const baseLon = 9.1900;
    phyphoxSimState = {
        t: 0,
        yaw: 0,
        pitch: 2,
        roll: -2,
        heading: 110,
        velocity: 0.6,
        targetVelocity: 1.2,
        height: 120,
        lat: baseLat,
        lon: baseLon,
        prevYaw: 0,
        prevPitch: 2,
        prevRoll: -2,
        prevVelocity: 0.6
    };
    const dt = PHYPHOX_SAMPLE_MS / 1000;
    phyphoxSimTimer = setInterval(() => {
        if (!phyphoxSimState) return;
        const state = phyphoxSimState;
        state.t += dt;

        if (Math.random() < 0.08) {
            state.targetVelocity = clamp(Math.random() * 2.8, 0, 3.2);
        }
        const velocityDelta = (state.targetVelocity - state.velocity) * 0.25 + jitter(0, 0.12);
        const prevVelocity = state.velocity;
        state.velocity = clamp(state.velocity + velocityDelta, 0, 3.5);

        const prevYaw = state.yaw;
        const prevPitch = state.pitch;
        const prevRoll = state.roll;
        state.heading = (state.heading + jitter(0, 1.6) + Math.sin(state.t / 18) * 1.4 + 360) % 360;
        state.yaw = clamp(Math.sin(state.t / 7) * 28 + jitter(0, 1.4), -90, 90);
        state.pitch = clamp(Math.sin(state.t / 9) * 12 + jitter(0, 1.1), -40, 40);
        state.roll = clamp(Math.cos(state.t / 8) * 10 + jitter(0, 1.1), -35, 35);

        const headingRad = state.heading * (Math.PI / 180);
        const accelForward = (state.velocity - prevVelocity) / dt;
        const linAccX = clamp(jitter(accelForward * Math.cos(headingRad), 0.4), -6, 6);
        const linAccY = clamp(jitter(accelForward * Math.sin(headingRad), 0.4), -6, 6);
        const linAccZ = clamp(jitter(Math.sin(state.t * 1.3) * 0.4, 0.18), -2, 2);

        const pitchRad = state.pitch * (Math.PI / 180);
        const rollRad = state.roll * (Math.PI / 180);
        const g = 9.81;
        const gravX = g * Math.sin(rollRad);
        const gravY = -g * Math.sin(pitchRad);
        const gravZ = g * Math.cos(rollRad) * Math.cos(pitchRad);

        const accelX = gravX + linAccX;
        const accelY = gravY + linAccY;
        const accelZ = gravZ + linAccZ;

        const gyroX = jitter(((state.roll - prevRoll) / dt) * (Math.PI / 180), 0.02);
        const gyroY = jitter(((state.pitch - prevPitch) / dt) * (Math.PI / 180), 0.02);
        const gyroZ = jitter(((state.yaw - prevYaw) / dt) * (Math.PI / 180), 0.02);

        const metersPerDegLat = 111320;
        const metersPerDegLon = metersPerDegLat * Math.cos(state.lat * Math.PI / 180);
        const distance = state.velocity * dt;
        const dNorth = Math.cos(headingRad) * distance;
        const dEast = Math.sin(headingRad) * distance;
        state.lat += dNorth / metersPerDegLat;
        state.lon += metersPerDegLon ? dEast / metersPerDegLon : 0;

        state.height = clamp(state.height + Math.sin(state.t / 40) * 0.05 + jitter(0, 0.02), 0, 2000);

        const values = {
            accelX,
            accelY,
            accelZ,
            linAccX,
            linAccY,
            linAccZ,
            gravX,
            gravY,
            gravZ,
            gyroX,
            gyroY,
            gyroZ,
            yaw: state.yaw,
            pitch: state.pitch,
            roll: state.roll,
            direct: state.heading,
            velocity: state.velocity,
            height: state.height,
            lat: state.lat,
            lon: state.lon
        };
        recordPhyphoxSample(values, new Date());
        state.prevVelocity = state.velocity;
        state.prevYaw = state.yaw;
        state.prevPitch = state.pitch;
        state.prevRoll = state.roll;
    }, PHYPHOX_SAMPLE_MS);
}

function stopPhyphoxSimulation() {
    if (phyphoxSimTimer) {
        clearInterval(phyphoxSimTimer);
        phyphoxSimTimer = null;
    }
    phyphoxSimState = null;
}

function connectPhyphox() {
    if (phyphoxMode !== 'live') return;
    if (phyphoxSimTimer) {
        const confirmed = window.confirm('Disconnettendo il sensore i dati rimarranno visibili ma non saranno più in tempo reale');
        if (!confirmed) return;
        disconnectPhyphox();
        return;
    }
    setPhyphoxStatus(true);
    setPhyphoxChartControlsEnabled(true);
    startPhyphoxMarkerCooldown();
    phyphoxConnectionStartTime = new Date();
    if (phyphoxConnectionTimeEl) {
        phyphoxConnectionTimeEl.textContent = `Dal: ${formatLocalTimestamp(phyphoxConnectionStartTime)}`;
    }
    if (phyphoxConnectionTimerId) clearInterval(phyphoxConnectionTimerId);
    phyphoxConnectionTimerId = setInterval(updatePhyphoxElapsedTime, 1000);
    updatePhyphoxElapsedTime();
    clearPhyphoxData();
    updatePhyphoxBattery(Math.round(65 + Math.random() * 30));
    startPhyphoxSimulation();
}

function disconnectPhyphox() {
    stopPhyphoxSimulation();
    setPhyphoxStatus(false);
    setPhyphoxChartControlsEnabled(false);
    if (phyphoxConnectionTimerId) clearInterval(phyphoxConnectionTimerId);
    phyphoxConnectionTimerId = null;
    phyphoxConnectionStartTime = null;
    if (phyphoxElapsedTimeEl) phyphoxElapsedTimeEl.textContent = '00:00:00';
    if (phyphoxConnectionTimeEl) phyphoxConnectionTimeEl.textContent = '';
    updatePhyphoxBattery(null);
}

function syncPhyphoxMarkersFromRows(rows) {
    phyphoxMarkers = [];
    let maxMarker = 0;
    rows.forEach((row) => {
        const marker = row?.marker;
        if (marker == null || marker === '') return;
        phyphoxMarkers.push({ timestamp: row.timestamp, label: marker });
        const num = Number(marker);
        if (Number.isFinite(num) && num > maxMarker) maxMarker = num;
    });
    phyphoxMarkerCounter = maxMarker > 0 ? maxMarker + 1 : 1;
}

function applyPhyphoxParsedRows(rows) {
    clearPhyphoxData();
    if (!rows || !rows.length) {
        alert('CSV senza righe dati.');
        return false;
    }
    phyphoxRecordedData = rows;
    syncPhyphoxMarkersFromRows(rows);
    rebuildPhyphoxMapFromRows(rows);

    const lastRow = rows[rows.length - 1];
    if (lastRow?.values) {
        updatePhyphoxLatest(lastRow.values);
        updatePhyphoxCardsFromLatest();
        updatePhyphoxTelemetry();
    }
    if (phyphoxElapsedLabelEl) phyphoxElapsedLabelEl.textContent = 'Durata totale';
    if (phyphoxConnectionTimeEl) phyphoxConnectionTimeEl.textContent = 'Da file CSV';
    const minTs = rows[0]?.timestamp;
    const maxTs = rows[rows.length - 1]?.timestamp;
    if (phyphoxElapsedTimeEl && Number.isFinite(minTs) && Number.isFinite(maxTs)) {
        phyphoxElapsedTimeEl.textContent = formatPhyphoxDuration(maxTs - minTs);
    }

    setPhyphoxMetricOptionsVisibilityForDebug({ preferred: phyphoxData.metric, forceFirst: true });
    phyphoxDebugWindowStart = Math.max(0, phyphoxRecordedData.length - PHYPHOX_WINDOW_POINTS);
    setPhyphoxChartControlsEnabled(phyphoxRecordedData.length > 0);
    redrawPhyphoxChart();
    return true;
}

function parsePhyphoxAppCsv(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return null;
    const { delimiter, header, headerLower, headerMap } = parseCsvHeader(lines);
    const metricCount = phyphoxMetricOrder.length;
    const hasLegacyHeader = headerLower[0] === 'time' && headerLower.length >= 1 + metricCount;
    if (hasLegacyHeader) {
        const hasMarker = headerLower[headerLower.length - 1] === 'marker';
        const availableMetrics = Math.min(metricCount, headerLower.length - 1 - (hasMarker ? 1 : 0));
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = splitCsvLine(line, delimiter);
            const rawTs = cols[0];
            const tsNum = normalizePhyphoxTimestamp(rawTs);
            const values = {};
            for (let m = 0; m < availableMetrics; m++) {
                const key = phyphoxMetricOrder[m];
                const val = parseCsvNumber(cols[1 + m]);
                if (val != null) values[key] = val;
            }
            if (!Object.keys(values).length && !hasMarker) continue;
            const row = {
                timestamp: tsNum,
                timestampLabel: formatPhyphoxTimeLabel(rawTs, tsNum),
                timestampFull: formatPhyphoxFullTimestamp(rawTs, tsNum),
                values
            };
            if (hasMarker) {
                const markerVal = (cols[cols.length - 1] || '').trim();
                if (markerVal) row.marker = markerVal;
            }
            rows.push(row);
        }
        return rows;
    }
    const idxTime = findHeaderIndex(headerMap, ['timestamp', 'time']);
    if (idxTime === -1) return null;
    const idxMarker = findHeaderIndex(headerMap, ['marker']);
    const metricIdx = {};
    phyphoxMetricOrder.forEach((key) => {
        const cfg = phyphoxMetricConfig[key];
        const idx = findHeaderIndex(headerMap, [key, cfg?.label, cfg?.header]);
        if (idx !== -1) metricIdx[key] = idx;
    });
    if (!Object.keys(metricIdx).length) return null;

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = splitCsvLine(line, delimiter);
        const rawTs = cols[idxTime];
        const tsNum = normalizePhyphoxTimestamp(rawTs);
        const values = {};
        Object.entries(metricIdx).forEach(([key, idx]) => {
            const val = parseCsvNumber(cols[idx]);
            if (val != null) values[key] = val;
        });
        if (!Object.keys(values).length && idxMarker === -1) continue;
        const row = {
            timestamp: tsNum,
            timestampLabel: formatPhyphoxTimeLabel(rawTs, tsNum),
            timestampFull: formatPhyphoxFullTimestamp(rawTs, tsNum),
            values
        };
        if (idxMarker !== -1) {
            const markerVal = (cols[idxMarker] || '').trim();
            if (markerVal) row.marker = markerVal;
        }
        rows.push(row);
    }
    return rows;
}

function isPhyphoxSensorHeader(headerLower) {
    return headerLower.includes('time (s)')
        || headerLower.includes('time(s)');
}

function parsePhyphoxSensorCsv(content, fileName) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    const { delimiter, headerMap, headerLower } = parseCsvHeader(lines);
    if (!isPhyphoxSensorHeader(headerLower)) return [];
    const idxTime = findHeaderIndex(headerMap, ['time (s)', 'time(s)', 'time']);
    if (idxTime === -1) return [];
    const fileKey = normalizeFileName(fileName);
    const metrics = phyphoxFileMetricMap[fileKey];
    if (!metrics || !metrics.length) return [];
    const metricCols = metrics
        .map((metric) => {
            const idx = findHeaderIndex(headerMap, [metric.header]);
            return idx !== -1 ? { key: metric.key, idx } : null;
        })
        .filter(Boolean);
    if (!metricCols.length) return [];

    const samples = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = splitCsvLine(line, delimiter);
        const timeSec = parseCsvNumber(cols[idxTime]);
        if (timeSec == null) continue;
        const values = {};
        metricCols.forEach(({ key, idx }) => {
            const val = parseCsvNumber(cols[idx]);
            if (val != null) values[key] = val;
        });
        if (!Object.keys(values).length) continue;
        samples.push({ timeSec, values });
    }
    return samples;
}

function parsePhyphoxMetaTimeCsv(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return null;
    const { delimiter, headerMap } = parseCsvHeader(lines);
    const idxEvent = findHeaderIndex(headerMap, ['event']);
    const idxExperiment = findHeaderIndex(headerMap, ['experiment time (s)', 'experiment time']);
    const idxSystem = findHeaderIndex(headerMap, ['system time (s)', 'system time']);
    if (idxSystem === -1) return null;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = splitCsvLine(line, delimiter);
        if (idxEvent !== -1) {
            const event = (cols[idxEvent] || '').trim().toUpperCase();
            if (event && event !== 'START') continue;
        }
        const systemTime = parseCsvNumber(cols[idxSystem]);
        if (systemTime == null) continue;
        const experimentTime = idxExperiment !== -1 ? parseCsvNumber(cols[idxExperiment]) : 0;
        const systemMs = systemTime > 1e11 ? systemTime : systemTime * 1000;
        const experimentMs = experimentTime > 1e11 ? experimentTime : (experimentTime || 0) * 1000;
        return systemMs - experimentMs;
    }
    return null;
}

function buildPhyphoxRowsFromSamples(samples, baseTimeMs) {
    if (!samples.length) return [];
    let minTimeSec = Infinity;
    samples.forEach((sample) => {
        if (sample.timeSec < minTimeSec) minTimeSec = sample.timeSec;
    });
    const baseMs = baseTimeMs != null ? baseTimeMs : (Date.now() - minTimeSec * 1000);
    const rowsByTs = new Map();
    samples.forEach((sample) => {
        const tsNum = Math.round(baseMs + sample.timeSec * 1000);
        const row = rowsByTs.get(tsNum) || {
            timestamp: tsNum,
            values: {}
        };
        Object.assign(row.values, sample.values);
        rowsByTs.set(tsNum, row);
    });
    const rows = Array.from(rowsByTs.values()).sort((a, b) => a.timestamp - b.timestamp);
    rows.forEach((row) => {
        row.timestampLabel = formatPhyphoxTimeLabel(row.timestamp, row.timestamp);
        row.timestampFull = formatLocalTimestamp(new Date(row.timestamp));
    });
    return rows;
}

function loadPhyphoxSamples(samples, baseTimeMs) {
    if (!samples.length) {
        alert('CSV senza righe dati.');
        return false;
    }
    const rows = buildPhyphoxRowsFromSamples(samples, baseTimeMs);
    if (!rows.length) {
        alert('CSV senza righe dati.');
        return false;
    }
    return applyPhyphoxParsedRows(rows);
}

function loadPhyphoxCsvDataFromText(text, options = {}) {
    const content = normalizeCsvContent(text);
    if (!content) {
        alert('CSV vuoto o non leggibile.');
        return false;
    }
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
        alert('Il file CSV non contiene dati sufficienti.');
        return false;
    }
    const { headerLower } = parseCsvHeader(lines);
    const fileKey = normalizeFileName(options.fileName || '');
    const shouldParseSensor = Boolean(fileKey && phyphoxFileMetricMap[fileKey]) || isPhyphoxSensorHeader(headerLower);
    if (shouldParseSensor) {
        const samples = parsePhyphoxSensorCsv(content, options.fileName || '');
        if (samples.length) {
            return loadPhyphoxSamples(samples, options.baseTimeMs);
        }
        if (fileKey && phyphoxFileMetricMap[fileKey]) {
            alert('CSV Phyphox non riconosciuto o privo di dati.');
            return false;
        }
    }
    const rows = parsePhyphoxAppCsv(content);
    if (!rows) {
        alert('CSV non valido: nessuna metrica riconosciuta.');
        return false;
    }
    return applyPhyphoxParsedRows(rows);
}

function exportPhyphoxCsv(mode, options = {}) {
    const { silent = false } = options;
    if (!phyphoxRecordedData.length) {
        if (!silent) alert('Nessun dato Phyphox da esportare');
        return null;
    }
    const markerByTs = new Map();
    phyphoxMarkers.forEach((marker) => {
        const ts = Number(marker?.timestamp);
        if (!Number.isFinite(ts)) return;
        markerByTs.set(String(ts), marker.label);
    });
    phyphoxRecordedData.forEach((row) => {
        if (row?.marker == null || row.marker === '') return;
        const ts = Number(row.timestamp);
        if (!Number.isFinite(ts)) return;
        markerByTs.set(String(ts), row.marker);
    });
    const getMarker = (ts) => markerByTs.get(String(Number(ts))) ?? '';

    if (mode === 'current') {
        const key = phyphoxData.metric;
        const cfg = phyphoxMetricConfig[key];
        if (!cfg) return null;
        const header = `timestamp,${key},marker\n`;
        const rows = phyphoxRecordedData.map(row => {
            const value = row.values?.[key];
            const formatted = (value == null || Number.isNaN(value)) ? '' : value.toFixed(cfg.decimals ?? 2);
            return `${formatLocalTimestamp(new Date(row.timestamp))},${formatted},${getMarker(row.timestamp)}`;
        }).join('\n');
        return header + rows;
    }

    const headerKeys = phyphoxMetricOrder;
    const header = `timestamp,${headerKeys.join(',')},marker\n`;
    const rows = phyphoxRecordedData.map(row => {
        const values = headerKeys.map((key) => {
            const cfg = phyphoxMetricConfig[key];
            const val = row.values?.[key];
            if (val == null || Number.isNaN(val)) return '';
            return val.toFixed(cfg.decimals ?? 2);
        });
        return `${formatLocalTimestamp(new Date(row.timestamp))},${values.join(',')},${getMarker(row.timestamp)}`;
    }).join('\n');
    return header + rows;
}

function exportPhyphoxLegacyCsv() {
    if (!phyphoxRecordedData.length) return null;
    const headers = ['Time'];
    phyphoxMetricOrder.forEach((key) => {
        const cfg = phyphoxMetricConfig[key];
        if (cfg?.header) headers.push(cfg.header);
    });
    headers.push('Marker');
    const rows = phyphoxRecordedData.map((row) => {
        const ts = new Date(row.timestamp);
        const timeLabel = `${pad2(ts.getHours())}:${pad2(ts.getMinutes())}:${pad2(ts.getSeconds())}.${String(ts.getMilliseconds()).padStart(3, '0')}`;
        const values = phyphoxMetricOrder.map((key) => {
            const cfg = phyphoxMetricConfig[key];
            const val = row.values?.[key];
            if (val == null || Number.isNaN(val)) return '';
            return val.toFixed(cfg.decimals ?? 2);
        });
        const marker = row.marker ?? '';
        return [timeLabel, ...values, marker].join(',');
    }).join('\n');
    return `${headers.join(',')}\n${rows}`;
}

function downloadPhyphoxCsvBundle() {
    if (!phyphoxRecordedData.length) {
        alert('Nessun dato Phyphox da esportare');
        return;
    }
    const currentContent = exportPhyphoxCsv('current', { silent: true });
    const fullContent = exportPhyphoxCsv('all', { silent: true });
    const legacyContent = exportPhyphoxLegacyCsv();
    if (!currentContent || !fullContent || !legacyContent) return;
    const sessionId = getNextPhyphoxSessionId();
    const dateStr = formatFileTimestamp(new Date());
    const baseName = `session${sessionId}-${dateStr}-phyphox`;
    const metricLabel = phyphoxMetricConfig[phyphoxData.metric]?.label || phyphoxData.metric;
    const viewLabel = slugifyLabel(metricLabel) || phyphoxData.metric || 'current';
    const zipBlob = createZipBlob([
        { name: `${baseName}-full.csv`, content: fullContent },
        { name: `${baseName}-${viewLabel}.csv`, content: currentContent },
        { name: `${baseName}-legacy.csv`, content: legacyContent }
    ]);
    downloadBlob(zipBlob, `${baseName}.zip`);
}

function findZipEnd(bytes) {
    for (let i = bytes.length - 22; i >= 0; i--) {
        if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
            return i;
        }
    }
    return -1;
}

function readZipEntries(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const eocdOffset = findZipEnd(bytes);
    if (eocdOffset < 0) throw new Error('ZIP non valido o corrotto.');
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const centralDirSize = view.getUint32(eocdOffset + 12, true);
    const centralDirOffset = view.getUint32(eocdOffset + 16, true);
    let offset = centralDirOffset;
    const decoder = new TextDecoder('utf-8');
    const entries = [];
    for (let i = 0; i < totalEntries && offset < centralDirOffset + centralDirSize; i++) {
        if (view.getUint32(offset, true) !== 0x02014b50) break;
        const compression = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const fileNameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localHeaderOffset = view.getUint32(offset + 42, true);
        const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
        offset += 46 + fileNameLength + extraLength + commentLength;
        if (name.endsWith('/')) continue;
        if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) continue;
        const nameLen = view.getUint16(localHeaderOffset + 26, true);
        const extraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataOffset = localHeaderOffset + 30 + nameLen + extraLen;
        const data = bytes.slice(dataOffset, dataOffset + compressedSize);
        entries.push({ name, compression, data });
    }
    return entries;
}

async function extractZipTextEntries(file) {
    const buffer = await file.arrayBuffer();
    const entries = readZipEntries(buffer);
    if (!entries.length) throw new Error('ZIP privo di file leggibili.');
    const decoder = new TextDecoder('utf-8');
    const output = {};
    for (const entry of entries) {
        let text = '';
        if (entry.compression === 0) {
            text = decoder.decode(entry.data);
        } else if (entry.compression === 8) {
            if (typeof DecompressionStream === 'undefined') {
                throw new Error('Il browser non supporta la decompressione ZIP.');
            }
            const stream = new Blob([entry.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
            const buf = await new Response(stream).arrayBuffer();
            text = decoder.decode(new Uint8Array(buf));
        } else {
            continue;
        }
        output[entry.name] = text;
    }
    return output;
}

async function loadPhyphoxZipFile(file) {
    const entries = await extractZipTextEntries(file);
    const entryNames = Object.keys(entries);
    const timeEntry = entryNames.find(name => normalizeFileName(name) === 'time.csv' && name.toLowerCase().includes('meta'));
    const baseTimeMs = timeEntry ? parsePhyphoxMetaTimeCsv(normalizeCsvContent(entries[timeEntry])) : null;
    const samples = [];
    entryNames.forEach((name) => {
        const fileKey = normalizeFileName(name);
        if (!phyphoxFileMetricMap[fileKey]) return;
        const content = normalizeCsvContent(entries[name]);
        if (!content) return;
        const fileSamples = parsePhyphoxSensorCsv(content, name);
        if (fileSamples.length) samples.push(...fileSamples);
    });
    if (!samples.length) {
        alert('ZIP Phyphox senza righe dati.');
        return false;
    }
    return loadPhyphoxSamples(samples, baseTimeMs);
}

async function readPhyphoxCsvFile(file) {
    if (!file) return;
    try {
        const lowerName = String(file.name || '').toLowerCase();
        if (lowerName.endsWith('.zip') || file.type === 'application/zip') {
            await loadPhyphoxZipFile(file);
            return;
        }
        let text = '';
        if (typeof file.text === 'function') {
            text = await file.text();
        }
        if (!text || !text.trim()) {
            if (typeof FileReader !== 'undefined') {
                text = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(reader.error || new Error('CSV read failed'));
                    reader.readAsText(file);
                });
            }
        }
        if (!text || !text.trim()) {
            alert('CSV vuoto o non leggibile.');
            return;
        }
        loadPhyphoxCsvDataFromText(text, { fileName: file.name });
    } catch (err) {
        console.error(err);
        alert('Errore nella lettura del file CSV o ZIP.');
    }
}

function setPhyphoxMode(mode) {
    if (mode === phyphoxMode) return;
    if (phyphoxMode === 'live' && mode === 'debug') {
        const confirmed = window.confirm('Passando alla modalità debug tutti i dati della sessione live verranno cancellati');
        if (!confirmed) return;
        disconnectPhyphox();
    } else if (phyphoxMode === 'debug' && mode === 'live') {
        const confirmed = window.confirm('Passando alla modalità live tutte le modifiche apportate al CSV verranno perse');
        if (!confirmed) return;
    }
    phyphoxMode = mode;
    phyphoxModeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.phyphoxMode === mode));
    if (phyphoxElapsedLabelEl) {
        phyphoxElapsedLabelEl.textContent = mode === 'debug' ? 'Durata totale' : 'Tempo trascorso';
    }
    if (mode === 'live') {
        if (phyphoxLoadCsvButton) phyphoxLoadCsvButton.style.display = 'none';
        if (phyphoxConnectButton) phyphoxConnectButton.style.display = 'block';
        if (phyphoxConnectionTimeEl) phyphoxConnectionTimeEl.textContent = '';
        if (phyphoxElapsedTimeEl) phyphoxElapsedTimeEl.textContent = '00:00:00';
        setPhyphoxStatus(false);
    } else {
        if (phyphoxConnectButton) phyphoxConnectButton.style.display = 'none';
        if (phyphoxLoadCsvButton) phyphoxLoadCsvButton.style.display = 'block';
        disconnectPhyphox();
        setPhyphoxStatus(false);
        if (phyphoxConnectionTimeEl) phyphoxConnectionTimeEl.textContent = '';
        if (phyphoxElapsedTimeEl) phyphoxElapsedTimeEl.textContent = '00:00:00';
    }
    clearPhyphoxData();
    phyphoxData.metric = 'accelX';
    if (phyphoxMetricSelect) phyphoxMetricSelect.value = 'accelX';
    setPhyphoxMetricOptionsVisibilityForDebug({ forceFirst: true });
    setPhyphoxChartControlsEnabled(false);
    updatePhyphoxChartScrollState();
    redrawPhyphoxChart();
}

export function initPhyphoxModule() {
    initPhyphoxChart();
    initPhyphoxMap();

    if (phyphoxConnectButton) phyphoxConnectButton.addEventListener('click', connectPhyphox);
    if (phyphoxLoadCsvButton) {
        phyphoxLoadCsvButton.addEventListener('click', () => {
            if (!ensurePhyphoxDebugMode()) return;
            if (phyphoxCsvInput) {
                phyphoxCsvInput.value = '';
                phyphoxCsvInput.click();
            }
        });
    }
    if (phyphoxCsvInput) {
        phyphoxCsvInput.addEventListener('change', (e) => {
            if (!ensurePhyphoxDebugMode()) return;
            const file = e.target.files[0];
            if (!file) return;
            readPhyphoxCsvFile(file);
            phyphoxCsvInput.value = '';
        });
    }
    if (phyphoxDownloadButton) phyphoxDownloadButton.addEventListener('click', downloadPhyphoxCsvBundle);
    if (phyphoxMarkerButton) phyphoxMarkerButton.addEventListener('click', addPhyphoxMarker);
    if (phyphoxChartScrollInput) {
        phyphoxChartScrollInput.addEventListener('input', () => {
            phyphoxDebugWindowStart = Number(phyphoxChartScrollInput.value) || 0;
            redrawPhyphoxChart();
        });
    }
    if (phyphoxMetricSelect) {
        phyphoxMetricSelect.addEventListener('change', () => {
            phyphoxData.metric = phyphoxMetricSelect.value;
            redrawPhyphoxChart();
        });
    }
    if (phyphoxMapZoomInButton) {
        phyphoxMapZoomInButton.addEventListener('click', () => {
            phyphoxMap?.zoomIn();
        });
    }
    if (phyphoxMapZoomOutButton) {
        phyphoxMapZoomOutButton.addEventListener('click', () => {
            phyphoxMap?.zoomOut();
        });
    }
    if (phyphoxModeButtons && phyphoxModeButtons.length) {
        phyphoxModeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.phyphoxMode;
                setPhyphoxMode(mode);
            });
        });
    }
    if (phyphoxChartContainer) {
        ['dragenter', 'dragover'].forEach((evt) => {
            phyphoxChartContainer.addEventListener(evt, (e) => {
                if (phyphoxMode !== 'debug') return;
                if (!e.dataTransfer || !e.dataTransfer.items || e.dataTransfer.items.length === 0) return;
                e.preventDefault();
                if (phyphoxChartDropZone) {
                    phyphoxChartDropZone.hidden = false;
                    phyphoxChartDropZone.style.opacity = '1';
                }
            });
        });
        ['dragleave', 'drop'].forEach((evt) => {
            phyphoxChartContainer.addEventListener(evt, (e) => {
                if (evt === 'dragleave' && e.currentTarget.contains(e.relatedTarget)) return;
                if (phyphoxChartDropZone) {
                    phyphoxChartDropZone.hidden = true;
                    phyphoxChartDropZone.style.opacity = '0';
                }
            });
        });
        phyphoxChartContainer.addEventListener('drop', (e) => {
            if (!ensurePhyphoxDebugMode()) return;
            e.preventDefault();
            if (phyphoxChartDropZone) {
                phyphoxChartDropZone.hidden = true;
                phyphoxChartDropZone.style.opacity = '0';
            }
            const file = e.dataTransfer?.files?.[0];
            if (!file) return;
            readPhyphoxCsvFile(file);
        });
    }
    window.addEventListener('resize', () => {
        drawPhyphoxMarkerOverlay();
        phyphoxMap?.invalidateSize();
    });

    setPhyphoxMode('live');
    setPhyphoxStatus(false);
    setPhyphoxChartControlsEnabled(false);
}
