import { pad2, extractTimeLabel, formatLocalTimestamp, formatFileTimestamp, parseTimestampString } from '../../lib/time.js';
import { createZipBlob } from '../../lib/zip.js';

// Muse elements
const museConnectButton = document.getElementById('museConnectButton');
const museLoadCsvButton = document.getElementById('museLoadCsvButton');
const museCsvInput = document.getElementById('museCsvInput');
const museModeButtons = document.querySelectorAll('.mode-btn-muse');
const museStatusLed = document.getElementById('museStatusLed');
const museStatusEl = document.getElementById('museStatus');
const museBatteryBadge = document.getElementById('museBatteryBadge');
const museElapsedTimeEl = document.getElementById('museElapsedTime');
const museElapsedLabelEl = document.getElementById('museElapsedLabel');
const museConnectionTimeEl = document.getElementById('museConnectionTime');
const museEndpointEl = document.getElementById('museEndpoint');
const museMetricSelect = document.getElementById('museMetricSelect');
const museViewSelect = document.getElementById('museViewSelect');
const museMetricsCard = document.getElementById('museMetricsCard');
const museChartContainer = document.getElementById('museChartContainer');
const museSpectrogramCanvas = document.getElementById('museSpectrogram');
const museDownloadButton = document.getElementById('museDownloadButton');
const museMarkerButton = document.getElementById('museMarkerButton');
const museMarkerOverlay = document.getElementById('museMarkerOverlay');
const museChartDropZone = document.getElementById('museChartDropZone');
const museChartScroll = document.getElementById('museChartScroll');
const museChartScrollInput = document.getElementById('museChartScrollInput');
const museBatteryValueEl = document.getElementById('museBatteryValue');
const museBatteryEtaEl = document.getElementById('museBatteryEta');
const museLegendEl = document.getElementById('museLegend');
const museMotionCircle = document.getElementById('museMotionCircle');
const museMotionDot = document.getElementById('museMotionDot');
const museMaxGValueEl = document.getElementById('museMaxGValue');
const museMaxGTimeEl = document.getElementById('museMaxGTime');
const museFftValueEl = document.getElementById('museValueFft');
const museValueEls = {
    eeg: document.getElementById('museValueEeg'),
    alphaAbsolute: document.getElementById('museValueAlphaAbs'),
    betaAbsolute: document.getElementById('museValueBetaAbs'),
    thetaAbsolute: document.getElementById('museValueThetaAbs'),
    deltaAbsolute: document.getElementById('museValueDeltaAbs'),
    gammaAbsolute: document.getElementById('museValueGammaAbs'),
    ppg: document.getElementById('museValuePpg'),
    optics: document.getElementById('museValueOptics')
};

let museWs = null;
let museMode = 'live';
let museConnectionStartTime = null;
let museConnectionTimerId = null;
let museChart = null;
let museData = {
    labels: [],
    values: [],
    metric: 'eeg'
};
let museRecordedData = [];
let museBatteryPct = null;
let museMaxG = null;
let museMaxGTimestamp = null;
let museEegChannelCount = 0;
let museLastRedrawTs = 0;
let museCurrentView = 'raw';
const museRawBuffer = [];
const museAbsoluteBuffer = [];
let museAbsoluteState = null;
let museBandHistory = {};
const museSpectrogramRows = [];
let museLastSpectroTs = 0;
let museDebugWindowStart = 0;
let museMarkerCounter = 1;
let museMarkerPoints = [];
let museMarkers = [];
let museMarkerCooldownTimer = null;
let museMarkerActive = true;
let museChartControlsEnabled = false;
let museSessionCounter = 1;
// allinea la finestra ai grafici Polar: finestre discrete e shift solo oltre il limite
const MUSE_WINDOW_POINTS = 100;
const MUSE_CHART_MAX_POINTS = 120;
const MUSE_EEG_WINDOW_POINTS = MUSE_WINDOW_POINTS;
const MUSE_EEG_CLAMP = 100; // ±100 µV tipico per visualizzazione clinica
const MUSE_EEG_OFFSET = 40; // offset visivo per separare i canali
const MUSE_MOTION_CLAMP = 1.5; // g clamp per visualizzare movimento
const MUSE_REDRAW_MS = 500; // throttling per evitare scroll continuo
const MUSE_SAMPLE_RATE_HZ = 256; // regolabile se il bridge espone un rate diverso
const MUSE_FFT_WINDOW_SEC = 2; // finestra FFT
const MUSE_SPECTRO_STEP_MS = 500;
const MUSE_SPECTRO_MAX_ROWS = 120;
const MUSE_SPECTRO_MAX_FREQ = 44; // Hz
const MUSE_MAX_RAW_SECONDS = 15;
const MUSE_BAND_HISTORY = 120;
const MUSE_BAND_TINY = 1e-3;
const MUSE_AXIS_FONT = { family: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' };
const museBuffers = {}; // buffer per tipo con finestra corta
const museTypeIdMap = {
    0: 'accelerometer',
    1: 'gyro',
    2: 'eeg',
    3: 'droppedAccelerometer',
    4: 'droppedEeg',
    5: 'quantization',
    6: 'battery',
    7: 'drlRef',
    8: 'alphaAbsolute',
    9: 'betaAbsolute',
    10: 'deltaAbsolute',
    11: 'thetaAbsolute',
    12: 'gammaAbsolute',
    13: 'alphaRelative',
    14: 'betaRelative',
    15: 'deltaRelative',
    16: 'thetaRelative',
    17: 'gammaRelative',
    18: 'alphaScore',
    19: 'betaScore',
    20: 'deltaScore',
    21: 'thetaScore',
    22: 'gammaScore',
    23: 'isGood',
    24: 'hsi',
    25: 'hsiPrecision',
    26: 'artifacts',
    27: 'magnetometer',
    28: 'pressure',
    29: 'temperature',
    30: 'ultraViolet',
    31: 'notchFilteredEeg',
    32: 'varianceEeg',
    33: 'varianceNotchFilteredEeg',
    34: 'ppg',
    35: 'isPpgGood',
    36: 'isHeartGood',
    37: 'thermistor',
    38: 'isThermistorGood',
    39: 'avgBodyTemperature',
    40: 'cloudComputed',
    41: 'optics'
};
const museLabels = {
    eeg: 'Raw EEG',
    alphaAbsolute: 'Alpha (α)',
    betaAbsolute: 'Beta (β)',
    thetaAbsolute: 'Theta (θ)',
    deltaAbsolute: 'Delta (δ)',
    gammaAbsolute: 'Gamma (γ)',
    ppg: 'PPG',
    optics: 'Optics',
    isHeartGood: 'Heart quality',
    accelerometer: 'Accelerometro',
    gyro: 'Giroscopio',
    battery: 'Batteria',
    fft: 'Discrete (FFT)',
    spectrogram: 'Spectrogram'
};
const museMetricConfig = {
    eeg: { unit: 'µV', decimals: 2 },
    alphaAbsolute: { unit: 'log PSD (0-100)', decimals: 2 },
    betaAbsolute: { unit: 'log PSD (0-100)', decimals: 2 },
    thetaAbsolute: { unit: 'log PSD (0-100)', decimals: 2 },
    deltaAbsolute: { unit: 'log PSD (0-100)', decimals: 2 },
    gammaAbsolute: { unit: 'log PSD (0-100)', decimals: 2 },
    ppg: { unit: 'arb. u.', decimals: 2 },
    optics: { unit: 'arb. u.', decimals: 2 },
    battery: { unit: '%', decimals: 0 },
    accelerometer: { unit: 'g', decimals: 2 },
    gyro: { unit: 'rot', decimals: 2 },
    fft: { unit: 'log power', decimals: 2 },
    spectrogram: { unit: '', decimals: 2 }
};
const museSelectableMetrics = Object.keys(museMetricConfig);
const museEegChannelNames = ['TP9', 'AF7', 'AF8', 'TP10', 'AUX'];
const museEegColors = [
    '#7c3aed',
    '#10b981',
    '#3b82f6',
    '#f59e0b',
    '#ef4444'
];
const museBandColors = {
    deltaAbsolute: '#8e44ad',
    thetaAbsolute: '#0a84ff',
    alphaAbsolute: '#34c759',
    betaAbsolute: '#f59e0b',
    gammaAbsolute: '#ff3b30'
};

function normalizeMuseTimestamp(rawTs) {
    if (rawTs == null) return Date.now();
    if (rawTs instanceof Date) return rawTs.getTime();
    if (typeof rawTs === 'string') {
        const parsed = parseTimestampString(rawTs);
        if (parsed) return parsed.getTime();
    }
    let tsNum = Number(rawTs);
    if (Number.isNaN(tsNum) || !Number.isFinite(tsNum)) return Date.now();
    // Heuristics: Muse SDK può usare microsecondi; porta a millisecondi
    if (tsNum > 1e13) {
        tsNum = Math.floor(tsNum / 1000); // microsecondi -> ms
    } else if (tsNum < 1e11) {
        tsNum = Math.floor(tsNum * 1000); // secondi -> ms
    }
    return tsNum;
}
function ensureMuseOption(typeKey) {
    if (!museMetricSelect) return;
    if (!museSelectableMetrics.includes(typeKey)) return;
    let exists = false;
    for (let i = 0; i < museMetricSelect.options.length; i++) {
        if (museMetricSelect.options[i].value === typeKey) {
            exists = true;
            break;
        }
    }
    if (!exists) {
        const opt = document.createElement('option');
        opt.value = typeKey;
        opt.textContent = museLabels[typeKey] || typeKey;
        museMetricSelect.appendChild(opt);
    }
}

function initMuseChart() {
    const ctxMuse = document.getElementById('museChart').getContext('2d');
    museChart = new Chart(ctxMuse, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'EEG (µV)',
                data: [],
                borderColor: '#8e44ad',
                backgroundColor: 'rgba(142, 68, 173, 0.12)',
                borderWidth: 1.5,
                tension: 0.05,
                pointRadius: 0
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
                    grid: { color: 'rgba(0, 0, 0, 0.04)' },
                    ticks: {
                        color: 'rgba(60, 60, 67, 0.7)',
                        font: MUSE_AXIS_FONT,
                        autoSkip: true,
                        maxTicksLimit: 6
                    },
                    title: {
                        display: true,
                        text: 'Tempo (HH:MM:SS)',
                        color: 'rgba(60, 60, 67, 0.7)'
                    }
                },
                y: {
                    display: true,
                    position: 'left',
                    min: -MUSE_EEG_CLAMP,
                    max: MUSE_EEG_CLAMP,
                    grid: { color: 'rgba(0, 0, 0, 0.04)' },
                    ticks: {
                        color: 'rgba(60, 60, 67, 0.7)',
                        font: MUSE_AXIS_FONT
                    },
                    title: { display: true, text: 'EEG (µV)', color: 'rgba(60, 60, 67, 0.7)' }
                }
            },
            plugins: { legend: { display: false } },
            animation: false
        }
    });
}

// ---------------- MUSE (EEG/PPG) ----------------
function museTypeKey(raw) {
    if (raw == null) return '';
    if (typeof raw === 'number') {
        return museTypeIdMap[raw] || `type${raw}`;
    }
    let s = String(raw);
    const paren = s.indexOf('(');
    if (paren >= 0) s = s.slice(0, paren);
    s = s.replace(/IXNMuseDataPacketType/gi, '');
    s = s.replace(/[^a-zA-Z0-9]/g, '');
    if (!s) return '';
    return s.charAt(0).toLowerCase() + s.slice(1);
}

function setMuseStatus(connected) {
    if (museMode === 'debug') {
        if (museStatusLed) museStatusLed.classList.remove('connected');
        if (museStatusEl) museStatusEl.textContent = 'Modalità debug';
        return;
    }
    if (museStatusLed) {
        museStatusLed.classList.toggle('connected', connected);
    }
    if (museStatusEl) {
        museStatusEl.textContent = connected ? 'Connesso' : 'Non connesso';
    }
    if (!connected && museBatteryBadge) museBatteryBadge.textContent = '--%';
}

function updateMuseElapsed() {
    if (!museConnectionStartTime || !museElapsedTimeEl) return;
    const now = new Date();
    const diffMs = now - museConnectionStartTime;
    const totalSeconds = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    museElapsedTimeEl.textContent = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function formatMuseDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function museChartValue(values) {
    if (!values || !values.length) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
}

function updateMuseValueDisplay(typeKey, values) {
    const targetEl = museValueEls[typeKey];
    if (!targetEl) return;
    const cfg = museMetricConfig[typeKey] || { decimals: 2 };
    let val = null;
    if (typeKey === 'eeg') {
        const absSum = values.reduce((sum, v) => sum + Math.abs(v), 0);
        val = values.length ? absSum / values.length : null;
    } else {
        val = museChartValue(values);
    }
    targetEl.textContent = (val != null && !Number.isNaN(val)) ? val.toFixed(cfg.decimals || 2) : '--';
}

function formatMuseTimestamp(ts) {
    if (!ts) return formatLocalTimestamp(new Date());
    if (typeof ts === 'string') {
        const parsed = parseTimestampString(ts);
        return parsed ? formatLocalTimestamp(parsed) : ts;
    }
    if (ts instanceof Date) return formatLocalTimestamp(ts);
    if (typeof ts === 'number') return formatLocalTimestamp(new Date(ts));
    return formatLocalTimestamp(new Date());
}

function formatMuseTimestampMs(ts) {
    let date = null;
    if (!ts) date = new Date();
    else if (ts instanceof Date) date = ts;
    else if (typeof ts === 'string') date = parseTimestampString(ts);
    else if (typeof ts === 'number') date = new Date(ts);
    if (!date) return formatMuseTimestamp(ts);
    const base = formatLocalTimestamp(date);
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${base}.${ms}`;
}

function formatBatteryMinutes(totalMinutes) {
    const minutes = Math.max(0, Math.round(totalMinutes));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h <= 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

// Stima residua: consumo medio 1% ogni 2-3 minuti.
function formatBatteryEta(pct) {
    if (!Number.isFinite(pct)) return '--';
    const minMinutes = pct * 2;
    const maxMinutes = pct * 3;
    const minLabel = formatBatteryMinutes(minMinutes);
    const maxLabel = formatBatteryMinutes(maxMinutes);
    const rangeLabel = (minLabel === maxLabel) ? minLabel : `${minLabel} - ${maxLabel}`;
    return rangeLabel;
}

function formatCsvValue(val, decimals = null) {
    if (val == null || val === '') return '';
    const num = Number(val);
    if (!Number.isFinite(num)) return '';
    if (decimals != null) return num.toFixed(decimals);
    return num.toString();
}

function parseCsvNumber(val) {
    if (val == null) return null;
    let str = String(val).trim();
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

function normalizeValueArray(values, size) {
    const arr = Array.isArray(values) ? values.slice(0, size) : [];
    while (arr.length < size) arr.push(null);
    return arr;
}

function slugifyLabel(label) {
    return String(label || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function getMuseViewLabel() {
    if (museViewSelect && museViewSelect.selectedIndex >= 0) {
        return museViewSelect.options[museViewSelect.selectedIndex].textContent || museCurrentView;
    }
    return museCurrentView;
}

function getNextMuseSessionId() {
    return pad2(museSessionCounter++);
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

function applyMuseMarkerState() {
    if (!museMarkerButton) return;
    const enabled = museChartControlsEnabled && museMarkerActive;
    museMarkerButton.disabled = !enabled;
    museMarkerButton.classList.toggle('disabled', !enabled);
    museMarkerButton.setAttribute('aria-disabled', (!enabled).toString());
}

function setMuseChartControlsEnabled(enabled) {
    museChartControlsEnabled = enabled;
    const iconButtons = [museDownloadButton, museMarkerButton];
    iconButtons.forEach((btn) => {
        if (!btn) return;
        btn.disabled = !enabled;
        btn.classList.toggle('disabled', !enabled);
        btn.setAttribute('aria-disabled', (!enabled).toString());
    });
    const selects = [museViewSelect, museMetricSelect];
    selects.forEach((sel) => {
        if (!sel) return;
        sel.disabled = !enabled;
        sel.classList.toggle('disabled', !enabled);
        sel.setAttribute('aria-disabled', (!enabled).toString());
    });
    if (museChartScrollInput) {
        museChartScrollInput.disabled = !enabled;
    }
    if (!enabled) {
        if (museMarkerCooldownTimer) clearTimeout(museMarkerCooldownTimer);
        museMarkerCooldownTimer = null;
        museMarkerActive = true;
    }
    applyMuseMarkerState();
}

function announceMuseCsvLoad(summary) {
    if (!museStatusEl || museMode === 'debug') return;
    const prev = museStatusEl.textContent;
    museStatusEl.textContent = summary;
    setTimeout(() => {
        if (museStatusEl.textContent === summary) {
            museStatusEl.textContent = prev;
        }
    }, 2500);
}

function reportMuseCsvIssue(summary, alertMessage = null) {
    if (summary) console.warn('[Muse CSV]', summary);
    if (alertMessage) {
        alert(alertMessage);
    }
}

function showAllMuseViewOptions() {
    if (!museViewSelect) return;
    Array.from(museViewSelect.options).forEach(opt => {
        opt.hidden = false;
        opt.disabled = false;
    });
}

function setMuseViewOptionsVisibilityForDebug(options = {}) {
    const { preferred = null, forceFirst = false } = options;
    if (!museViewSelect) return;
    if (museMode !== 'debug' || !museRecordedData.length) {
        showAllMuseViewOptions();
        return;
    }
    const typeSet = new Set(museRecordedData.map(row => row.type));
    const hasBands = ['alphaAbsolute', 'betaAbsolute', 'thetaAbsolute', 'deltaAbsolute', 'gammaAbsolute']
        .some(key => typeSet.has(key));
    const availability = {
        raw: typeSet.has('eeg'),
        absolute: hasBands,
        fft: typeSet.has('eeg'),
        ppg: typeSet.has('ppg'),
        optics: typeSet.has('optics'),
        accelerometer: typeSet.has('accelerometer'),
        gyroscope: typeSet.has('gyro'),
        battery: typeSet.has('battery')
    };
    let firstAvailable = null;
    Array.from(museViewSelect.options).forEach(opt => {
        const available = availability[opt.value] !== false;
        opt.hidden = !available;
        opt.disabled = !available;
        if (available && !firstAvailable) firstAvailable = opt.value;
    });

    const selectedOption = Array.from(museViewSelect.options).find(opt => opt.value === museViewSelect.value);
    const selectedAvailable = selectedOption ? !selectedOption.disabled : false;
    let target = null;
    if (preferred && availability[preferred] !== false) {
        target = preferred;
    } else if (forceFirst || !selectedAvailable) {
        target = firstAvailable;
    }
    if (target && target !== museCurrentView) {
        setMuseView(target);
    } else if (target && museViewSelect.value !== target) {
        museViewSelect.value = target;
    }
}

function startMuseMarkerCooldown(durationMs = 15000) {
    if (!museMarkerButton) return;
    museMarkerActive = false;
    if (museMarkerCooldownTimer) clearTimeout(museMarkerCooldownTimer);
    museMarkerCooldownTimer = setTimeout(() => {
        museMarkerCooldownTimer = null;
        museMarkerActive = true;
        applyMuseMarkerState();
    }, durationMs);
    applyMuseMarkerState();
}

function ensureMuseDebugMode() {
    if (museMode === 'debug') return true;
    setMuseMode('debug');
    return museMode === 'debug';
}

// Normalizza la potenza di banda in un range 0-100 per l'UI.
function normalizeMuseBandValue(typeKey, values) {
    if (!Array.isArray(values) || !values.length) return null;
    const avg = museChartValue(values);
    if (avg == null || Number.isNaN(avg)) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const tinyRange = Math.max(Math.abs(min), Math.abs(max)) < MUSE_BAND_TINY;
    let scaled;
    if (min >= 0 && max <= 1 && !tinyRange) {
        scaled = avg * 100;
    } else if (min >= -1 && max <= 1 && !tinyRange) {
        scaled = ((avg + 1) / 2) * 100;
    } else if (min >= 0 && max <= 100 && !tinyRange) {
        scaled = avg;
    } else {
        if (!museBandHistory[typeKey]) museBandHistory[typeKey] = [];
        const history = museBandHistory[typeKey];
        history.push(avg);
        if (history.length > MUSE_BAND_HISTORY) history.shift();
        let histMin = Infinity;
        let histMax = -Infinity;
        history.forEach((v) => {
            if (v < histMin) histMin = v;
            if (v > histMax) histMax = v;
        });
        if (histMin === Infinity || histMax === -Infinity) return null;
        const span = histMax - histMin;
        if (!Number.isFinite(span) || span <= 0) return 50;
        scaled = ((avg - histMin) / span) * 100;
    }
    if (!Number.isFinite(scaled)) return null;
    return Math.max(0, Math.min(100, scaled));
}

function updateMuseMotion(values, timestamp) {
    if (!museMotionCircle || !museMotionDot || !Array.isArray(values) || values.length < 2) return;
    const rawX = Number(values[0]);
    const rawY = Number(values[1]);
    const rawZ = Number(values[2] ?? 0);
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY) || !Number.isFinite(rawZ)) return;
    // Swap axes so forward/back maps to vertical and left/right maps to horizontal.
    const x = rawY;
    const y = rawX;
    const nx = Math.max(-1, Math.min(1, x / MUSE_MOTION_CLAMP));
    const ny = Math.max(-1, Math.min(1, y / MUSE_MOTION_CLAMP));
    const radius = (museMotionCircle.clientWidth - museMotionDot.clientWidth) / 2;
    if (!Number.isFinite(radius) || radius <= 0) return;
    const px = nx * radius;
    const py = -ny * radius;
    museMotionDot.style.opacity = '1';
    museMotionDot.style.transform = `translate(-50%, -50%) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
    const g = Math.sqrt(rawX * rawX + rawY * rawY + rawZ * rawZ);
    if (Number.isFinite(g)) {
        if (museMaxG == null || g > museMaxG) {
            museMaxG = g;
            museMaxGTimestamp = formatMuseTimestamp(timestamp);
            if (museMaxGValueEl) museMaxGValueEl.textContent = g.toFixed(2);
            if (museMaxGTimeEl) museMaxGTimeEl.textContent = museMaxGTimestamp;
        }
    }
}


function resetMuseMotion() {
    if (museMotionDot) {
        museMotionDot.style.opacity = '0.6';
        museMotionDot.style.transform = 'translate(-50%, -50%)';
    }
}

function resetMuseValues() {
    Object.values(museValueEls).forEach(el => {
        if (el) el.textContent = '--';
    });
    if (museBatteryValueEl) museBatteryValueEl.textContent = '--';
    if (museBatteryEtaEl) museBatteryEtaEl.textContent = formatBatteryEta(Number.NaN);
    if (museFftValueEl) museFftValueEl.textContent = '--';
    if (museBatteryBadge) museBatteryBadge.textContent = '--%';
    resetMuseMotion();
    museMaxG = null;
    museMaxGTimestamp = null;
    if (museMaxGValueEl) museMaxGValueEl.textContent = '--';
    if (museMaxGTimeEl) museMaxGTimeEl.textContent = '--';
    Object.keys(museBuffers).forEach(k => { museBuffers[k] = []; });
    museAbsoluteBuffer.length = 0;
    museAbsoluteState = null;
    museBandHistory = {};
    museDebugWindowStart = 0;
    museMarkerCounter = 1;
    museMarkerPoints = [];
    museMarkers = [];
    drawMuseMarkerOverlay();
}

function renderMuseLegend(channelCount, overrideNames, overrideColors) {
    if (!museLegendEl) return;
    if (!overrideNames && museCurrentView !== 'raw' && museData.metric !== 'eeg') {
        museLegendEl.innerHTML = '';
        return;
    }
    const names = overrideNames || museEegChannelNames.slice(0, channelCount).map((n, i) => n || `CH${i + 1}`);
    const colors = overrideColors || museEegColors;
    const html = names.map((name, idx) => {
        const color = colors[idx % colors.length];
        return `<span class="legend-item"><span class="legend-swatch" style="background:${color}"></span>${name}</span>`;
        }).join('');
    museLegendEl.innerHTML = html;
}

function isMuseDebugScrollableView() {
    if (museMode !== 'debug') return false;
    return !['battery', 'spectrogram', 'fft'].includes(museCurrentView);
}

function getMuseWindowSizeForView() {
    if (museCurrentView === 'raw') return MUSE_EEG_WINDOW_POINTS;
    if (museCurrentView === 'battery') return Infinity;
    if (museCurrentView === 'default' && museData.metric === 'eeg') return MUSE_EEG_WINDOW_POINTS;
    return MUSE_WINDOW_POINTS;
}

function getMuseBufferForView() {
    switch (museCurrentView) {
        case 'raw':
            return museBuffers.eeg || [];
        case 'absolute':
            return museAbsoluteBuffer;
        case 'ppg':
            return museBuffers.ppg || [];
        case 'optics':
            return museBuffers.optics || [];
        case 'accelerometer':
            return museBuffers.accelerometer || [];
        case 'gyroscope':
            return museBuffers.gyro || [];
        case 'battery':
            return museBuffers.battery || [];
        default:
            return museBuffers[museData.metric] || [];
    }
}

function getMuseWindowSlice(rows, windowSize) {
    if (!Array.isArray(rows)) return [];
    if (windowSize === Infinity) return rows.slice();
    const size = windowSize ?? MUSE_WINDOW_POINTS;
    if (!isMuseDebugScrollableView()) return rows.slice(-size);
    const maxStart = Math.max(0, rows.length - size);
    if (museDebugWindowStart > maxStart) museDebugWindowStart = maxStart;
    const start = Math.max(0, museDebugWindowStart);
    return rows.slice(start, start + size);
}

function updateMuseChartScrollState() {
    if (!museChartScroll || !museChartScrollInput) return;
    const windowSize = getMuseWindowSizeForView();
    const bufferLen = getMuseBufferForView().length;
    const maxStart = windowSize === Infinity ? 0 : Math.max(0, bufferLen - windowSize);
    const shouldShow = isMuseDebugScrollableView() && maxStart > 0;
    museChartScroll.hidden = !shouldShow;
    if (!shouldShow) {
        museDebugWindowStart = 0;
        return;
    }
    if (museDebugWindowStart > maxStart) museDebugWindowStart = maxStart;
    museChartScrollInput.min = '0';
    museChartScrollInput.max = `${maxStart}`;
    museChartScrollInput.step = '1';
    museChartScrollInput.value = `${museDebugWindowStart}`;
}

function setMuseDropZoneVisible(visible) {
    if (!museChartDropZone) return;
    museChartDropZone.hidden = !visible;
    museChartDropZone.style.opacity = visible ? '1' : '0';
}

function getMuseWindowMeta() {
    const buffer = getMuseBufferForView();
    const windowSize = getMuseWindowSizeForView();
    if (windowSize === Infinity) {
        return { buffer, rows: buffer.slice(), startIndex: 0 };
    }
    const maxStart = Math.max(0, buffer.length - windowSize);
    const startIndex = isMuseDebugScrollableView()
        ? Math.min(museDebugWindowStart, maxStart)
        : Math.max(0, maxStart);
    return {
        buffer,
        rows: buffer.slice(startIndex, startIndex + windowSize),
        startIndex
    };
}

function museRowHasValue(row) {
    if (!row) return false;
    if (museCurrentView === 'absolute') {
        const vals = row.values ? Object.values(row.values) : [];
        return vals.some(v => v != null && Number.isFinite(Number(v)));
    }
    const vals = Array.isArray(row.values) ? row.values : [];
    return vals.some(v => v != null && Number.isFinite(Number(v)));
}

function rebuildMuseMarkersDataset() {
    if (!museChart || !museMarkerOverlay) return;
    const markerEnabled = !['spectrogram', 'fft'].includes(museCurrentView);
    museMarkerOverlay.style.display = markerEnabled ? 'block' : 'none';
    if (!markerEnabled) {
        museMarkerPoints = [];
        return;
    }
    const { rows } = getMuseWindowMeta();
    museMarkerPoints = [];
    const rowMarkerLabels = new Set();
    rows.forEach((row, idx) => {
        if (row && row.marker != null && row.marker !== '') {
            museMarkerPoints.push({ xIndex: idx, marker: row.marker });
            rowMarkerLabels.add(String(row.marker));
        }
    });
    const markers = museMarkers.filter(marker => !rowMarkerLabels.has(String(marker?.label)));
    if (rows.length && markers.length) {
        let minTs = Infinity;
        let maxTs = -Infinity;
        rows.forEach((row) => {
            const ts = Number(row?.timestamp);
            if (!Number.isFinite(ts)) return;
            if (ts < minTs) minTs = ts;
            if (ts > maxTs) maxTs = ts;
        });
        markers.forEach((marker) => {
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
                museMarkerPoints.push({ xIndex: bestIdx, marker: marker.label });
            }
        });
    }
    requestAnimationFrame(drawMuseMarkerOverlay);
}

function drawMuseMarkerOverlay() {
    if (!museMarkerOverlay || !museChart || !museChart.scales?.x || !museChart.scales?.y) return;
    if (museMarkerOverlay.style.display === 'none') return;
    const xScale = museChart.scales.x;
    const yScale = museChart.scales.y;
    const chartArea = museChart.chartArea;
    const rect = museChart.canvas.getBoundingClientRect();
    const containerRect = museChartContainer?.getBoundingClientRect();
    const offsetX = containerRect ? rect.left - containerRect.left : 0;
    const offsetY = containerRect ? rect.top - containerRect.top : 0;
    const dpr = window.devicePixelRatio || 1;
    const canvasScale = rect.width ? (museChart.canvas.width / rect.width) : dpr;
    const chartMaxRight = chartArea?.right ?? xScale.right ?? 0;
    const needsScale = rect.width > 0 && chartMaxRight > rect.width + 1;
    const toCss = (v) => (needsScale ? (v / canvasScale) : v);
    museMarkerOverlay.width = rect.width * dpr;
    museMarkerOverlay.height = rect.height * dpr;
    museMarkerOverlay.style.width = `${rect.width}px`;
    museMarkerOverlay.style.height = `${rect.height}px`;
    museMarkerOverlay.style.left = `${offsetX}px`;
    museMarkerOverlay.style.top = `${offsetY}px`;
    const ctx = museMarkerOverlay.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!museMarkerPoints.length) {
        ctx.restore();
        return;
    }

    const left = toCss(Number.isFinite(xScale.left) ? xScale.left : (chartArea?.left ?? 0));
    const right = toCss(Number.isFinite(xScale.right) ? xScale.right : (chartArea?.right ?? rect.width));
    const yTop = toCss(Number.isFinite(yScale.top) ? yScale.top : (chartArea?.top ?? 0));
    const MARKER_LINE_HEIGHT = 168;
    const yBottom = Math.min(yTop + MARKER_LINE_HEIGHT, rect.height);
    if (right > left && yBottom > yTop) {
        ctx.beginPath();
        ctx.rect(left, yTop, right - left, yBottom - yTop);
        ctx.clip();
    }
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = '#ff9f0a';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#ff9f0a';

    museMarkerPoints.forEach((pt) => {
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

function addMuseMarker() {
    if (!museChart) return;
    const { rows } = getMuseWindowMeta();
    if (!rows.length) {
        alert('Nessun dato disponibile per inserire un marker.');
        return;
    }
    let target = null;
    for (let i = rows.length - 1; i >= 0; i--) {
        if (museRowHasValue(rows[i])) {
            target = rows[i];
            break;
        }
    }
    if (!target) {
        target = rows[rows.length - 1] || null;
    }
    if (!target) {
        alert('Nessun dato disponibile per inserire un marker.');
        return;
    }
    const label = museMarkerCounter++;
    target.marker = label;
    museMarkers.push({ timestamp: target.timestamp, label });
    rebuildMuseMarkersDataset();
    museChart.update('none');
}

function redrawMuseChart() {
    if (!museChart) return;
    const chartCanvas = museChart.canvas;
    if (museLegendEl && museCurrentView !== 'raw' && museCurrentView !== 'absolute') {
        museLegendEl.innerHTML = '';
    }
    if (museSpectrogramCanvas) {
        museSpectrogramCanvas.classList.toggle('active', museCurrentView === 'spectrogram');
    }
    if (chartCanvas) {
        chartCanvas.style.display = museCurrentView === 'spectrogram' ? 'none' : 'block';
    }

    if (museCurrentView === 'spectrogram') {
        drawSpectrogram();
        updateMuseChartScrollState();
        rebuildMuseMarkersDataset();
        return;
    }

    museChart.data.labels = [];
    museChart.data.datasets = [];

    switch (museCurrentView) {
        case 'raw':
            renderRawChart();
            break;
        case 'absolute':
            renderAbsoluteChart();
            break;
        case 'fft':
            renderFftChart();
            break;
        case 'ppg':
            renderSingleMetric('ppg');
            break;
        case 'optics':
            renderSingleMetric('optics');
            break;
        case 'accelerometer':
        case 'gyroscope':
            renderVectorChart(museCurrentView === 'accelerometer' ? 'accelerometer' : 'gyro');
            break;
        case 'battery':
            renderSingleMetric('battery');
            break;
        default:
            renderSingleMetric(museData.metric || 'eeg');
            break;
    }
    updateMuseChartScrollState();
    rebuildMuseMarkersDataset();
}

function renderRawChart() {
    const unit = museMetricConfig.eeg?.unit || 'µV';
    const buffer = museBuffers.eeg || [];
    const rows = getMuseWindowSlice(buffer, MUSE_EEG_WINDOW_POINTS);
    let channelCount = Math.max(
        museEegChannelCount,
        ...rows.map(r => r.values.length),
        0
    );
    if (channelCount === 0) {
        channelCount = Math.min(4, museEegChannelNames.length);
    }
    museEegChannelCount = channelCount;
    const channelNames = museEegChannelNames.slice(0, channelCount).map((n, i) => n || `CH${i + 1}`);
    museChart.data.datasets = channelNames.map((name, idx) => ({
        label: `${name} (${unit})`,
        data: [],
        borderColor: museEegColors[idx % museEegColors.length],
        backgroundColor: museEegColors[idx % museEegColors.length] + '26',
        borderWidth: 1.5,
        tension: 0.05,
        pointRadius: 0
    }));
    renderMuseLegend(channelCount);

    let minY = Infinity;
    let maxY = -Infinity;
    const channelMeans = new Array(channelCount).fill(0);
    const channelCounts = new Array(channelCount).fill(0);
    rows.forEach((row) => {
        for (let i = 0; i < channelCount; i++) {
            const v = row.values[i];
            if (v != null && !Number.isNaN(v)) {
                channelMeans[i] += v;
                channelCounts[i] += 1;
            }
        }
    });
    for (let i = 0; i < channelCount; i++) {
        channelMeans[i] = channelCounts[i] ? channelMeans[i] / channelCounts[i] : 0;
    }

    rows.forEach((row) => {
        const label = row.timestampLabel || extractTimeLabel(row.timestamp);
        museChart.data.labels.push(label);
        for (let i = 0; i < channelCount; i++) {
            const raw = row.values[i];
            const centeredVal = (raw != null && !Number.isNaN(raw)) ? (raw - channelMeans[i]) : null;
            const centered = (centeredVal != null && !Number.isNaN(centeredVal)) ? Math.max(-MUSE_EEG_CLAMP, Math.min(MUSE_EEG_CLAMP, centeredVal)) : null;
            const offset = (channelCount > 1) ? (i - (channelCount - 1) / 2) * MUSE_EEG_OFFSET : 0;
            const val = centered != null ? centered + offset : null;
            museChart.data.datasets[i].data.push(val);
            if (val != null && !Number.isNaN(val)) {
                minY = Math.min(minY, val);
                maxY = Math.max(maxY, val);
            }
        }
    });

    if (minY === Infinity || maxY === -Infinity) {
        minY = -MUSE_EEG_CLAMP;
        maxY = MUSE_EEG_CLAMP;
    }
    if (minY === maxY) {
        minY -= 1;
        maxY += 1;
    }
    const offsetSpan = ((channelCount - 1) * MUSE_EEG_OFFSET) / 2;
    minY = Math.min(minY, -MUSE_EEG_CLAMP - offsetSpan);
    maxY = Math.max(maxY, MUSE_EEG_CLAMP + offsetSpan);
    if (museChart.options?.scales?.y?.title) {
        museChart.options.scales.y.title.text = 'EEG (µV)';
    }
    if (museChart.options?.scales?.x?.title) {
        museChart.options.scales.x.title.text = 'Tempo (HH:MM:SS)';
    }
    museChart.options.scales.y.min = minY;
    museChart.options.scales.y.max = maxY;
    museChart.update('none');
}

function renderAbsoluteChart() {
    const bands = ['alphaAbsolute', 'betaAbsolute', 'thetaAbsolute', 'deltaAbsolute', 'gammaAbsolute'];
    const colors = bands.map((band, idx) => museBandColors[band] || museEegColors[idx % museEegColors.length]);
    const rows = getMuseWindowSlice(museAbsoluteBuffer, MUSE_WINDOW_POINTS);
    museChart.data.labels = rows.map(r => r.timestampLabel || extractTimeLabel(r.timestamp));
    museChart.data.datasets = bands.map((b, idx) => ({
        label: museLabels[b] || b,
        data: rows.map(r => r.values[b] ?? null),
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length] + '20',
        borderWidth: 1.5,
        tension: 0.05,
        pointRadius: 0
    }));
    renderMuseLegend(bands.length, bands.map(b => museLabels[b] || b), colors);
    museChart.options.scales.y.min = 0;
    museChart.options.scales.y.max = 100;
    if (museChart.options?.scales?.y?.title) {
        museChart.options.scales.y.title.text = 'Bande log PSD (0-100)';
    }
    if (museChart.options?.scales?.x?.title) {
        museChart.options.scales.x.title.text = 'Tempo (HH:MM:SS)';
    }
    museChart.update('none');
}

function renderFftChart() {
    const spectrum = computeFftFromRaw();
    if (!spectrum) return;
    updateMuseFftValue(spectrum);
    const friendly = museLabels.fft || 'FFT';
    museChart.data.labels = spectrum.freqs;
    museChart.data.datasets = [{
        label: friendly,
        data: spectrum.mags,
        borderColor: '#8e44ad',
        backgroundColor: 'rgba(142,68,173,0.18)',
        borderWidth: 1.5,
        tension: 0.05,
        pointRadius: 0
    }];
    if (museChart.options?.scales?.y?.title) {
        museChart.options.scales.y.title.text = 'Log power';
    }
    museChart.options.scales.y.min = undefined;
    museChart.options.scales.y.max = undefined;
    museChart.options.scales.x.title.text = 'Frequenza (Hz)';
    museChart.update('none');
}

function updateMuseFftValue(spectrum) {
    if (!museFftValueEl || !spectrum?.mags?.length) return;
    const validMags = spectrum.mags.filter(v => v != null && !Number.isNaN(v));
    if (!validMags.length) {
        museFftValueEl.textContent = '--';
        return;
    }
    const peak = Math.max(...validMags);
    museFftValueEl.textContent = Number.isFinite(peak) ? peak.toFixed(museMetricConfig.fft?.decimals || 2) : '--';
}

function renderVectorChart(typeKey) {
    const buffer = museBuffers[typeKey] || [];
    const rows = getMuseWindowSlice(buffer, MUSE_WINDOW_POINTS);
    const axes = ['X', 'Y', 'Z'];
    const colors = ['#0a84ff', '#ff3b30', '#34c759'];
    if (museLegendEl) museLegendEl.innerHTML = '';
    museChart.data.labels = rows.map(r => r.timestampLabel || extractTimeLabel(r.timestamp));
    museChart.data.datasets = axes.map((axis, idx) => ({
        label: axis,
        data: rows.map(r => (Array.isArray(r.values) ? r.values[idx] ?? null : null)),
        borderColor: colors[idx],
        backgroundColor: colors[idx] + '20',
        borderWidth: 1.5,
        tension: 0.05,
        pointRadius: 0
    }));
    if (museChart.options?.scales?.y?.title) {
        const friendly = museLabels[typeKey] || typeKey;
        const unit = museMetricConfig[typeKey]?.unit || '';
        museChart.options.scales.y.title.text = unit ? `${friendly} (${unit})` : friendly;
    }
    if (museChart.options?.scales?.x?.title) {
        museChart.options.scales.x.title.text = 'Tempo (HH:MM:SS)';
    }
    museChart.options.scales.y.min = undefined;
    museChart.options.scales.y.max = undefined;
    museChart.update('none');
}

function renderSingleMetric(metricKey) {
    const unit = museMetricConfig[metricKey]?.unit;
    const friendlyLabel = museLabels[metricKey] || metricKey;
    const yLabel = unit ? `${friendlyLabel} (${unit})` : friendlyLabel;
    if (museLegendEl) museLegendEl.innerHTML = '';
    museChart.data.datasets = [{
        label: yLabel,
        data: [],
        borderColor: metricKey === 'battery' ? '#ff9f0a' : '#8e44ad',
        backgroundColor: metricKey === 'battery' ? 'rgba(255, 159, 10, 0.18)' : 'rgba(142, 68, 173, 0.18)',
        borderWidth: 1.8,
        tension: 0.05,
        pointRadius: 0
    }];

    let minY = Infinity;
    let maxY = -Infinity;
    const buffer = museBuffers[metricKey] || [];
    const rows = metricKey === 'battery' ? buffer : getMuseWindowSlice(buffer, MUSE_WINDOW_POINTS);
    rows.forEach((row) => {
        const val = museChartValue(row.values);
        if (val != null && !Number.isNaN(val)) {
            museChart.data.labels.push(row.timestampLabel || extractTimeLabel(row.timestamp));
            museChart.data.datasets[0].data.push(val);
            minY = Math.min(minY, val);
            maxY = Math.max(maxY, val);
        }
    });
    if (minY === Infinity || maxY === -Infinity) {
        minY = metricKey === 'battery' ? 0 : 0;
        maxY = metricKey === 'battery' ? 100 : 1;
    }
    if (minY === maxY) {
        minY -= metricKey === 'battery' ? 1 : 0.5;
        maxY += metricKey === 'battery' ? 1 : 0.5;
    }
    const span = maxY - minY;
    if (metricKey === 'battery') {
        const pad = span > 0 ? Math.max(1, span * 0.1) : 2;
        minY = Math.max(0, minY - pad);
        maxY = Math.min(105, maxY + pad);
    } else if (span > 0) {
        const pad = Math.max(0.1 * span, 0.5);
        minY = minY - pad;
        maxY = maxY + pad;
    } else {
        minY -= 0.5;
        maxY += 0.5;
    }
    if (museChart.options?.scales?.y?.title) {
        museChart.options.scales.y.title.text = yLabel;
    }
    if (museChart.options?.scales?.x?.title) {
        museChart.options.scales.x.title.text = 'Tempo (HH:MM:SS)';
    }
    museChart.options.scales.y.min = minY;
    museChart.options.scales.y.max = maxY;
    museChart.update('none');
}

function updateMuseSingleRange() {
    if (!museChart) return;
    if (museCurrentView !== 'battery' && museCurrentView !== 'default') {
        return;
    }
    const metricKey = museCurrentView === 'battery' ? 'battery' : museData.metric;
    const dataVals = (museChart.data.datasets[0]?.data || []).filter(v => v != null && !Number.isNaN(v));
    if (!dataVals.length) return;
    let minY = Math.min(...dataVals);
    let maxY = Math.max(...dataVals);
    if (minY === maxY) {
        minY -= 0.5;
        maxY += 0.5;
    }
    const span = maxY - minY;
    const pad = Math.max(0.1 * span, 0.5);
    if (metricKey === 'battery') {
        minY = Math.max(0, minY - pad);
        maxY = Math.min(105, maxY + pad);
    } else {
        minY = minY - pad;
        maxY = maxY + pad;
    }
    const unit = museMetricConfig[metricKey]?.unit;
    const friendly = museLabels[metricKey] || metricKey;
    const yLabel = unit ? `${friendly} (${unit})` : friendly;
    if (museChart.options?.scales?.y?.title) {
        museChart.options.scales.y.title.text = yLabel;
    }
    museChart.options.scales.y.min = minY;
    museChart.options.scales.y.max = maxY;
}

function pushRawSample(ts, values, tsLabel) {
    museRawBuffer.push({ timestamp: ts, timestampLabel: tsLabel, values });
    const maxLen = MUSE_SAMPLE_RATE_HZ * MUSE_MAX_RAW_SECONDS;
    if (museRawBuffer.length > maxLen) museRawBuffer.shift();
}

function pushAbsoluteSample(typeKey, ts, tsLabel, value) {
    if (!museAbsoluteState) museAbsoluteState = {};
    museAbsoluteState[typeKey] = value;
    const row = { timestamp: ts, timestampLabel: tsLabel, values: { ...museAbsoluteState } };
    museAbsoluteBuffer.push(row);
    const maxLen = museMode === 'debug' ? Infinity : MUSE_WINDOW_POINTS;
    if (maxLen !== Infinity && museAbsoluteBuffer.length > maxLen) museAbsoluteBuffer.shift();
}

function computeFftFromRaw() {
    const needed = Math.floor(MUSE_SAMPLE_RATE_HZ * MUSE_FFT_WINDOW_SEC);
    if (museRawBuffer.length < needed) return null;
    const samples = museRawBuffer.slice(-needed).map(r => (Array.isArray(r.values) ? r.values[0] ?? 0 : 0));
    const windowed = applyHamming(samples);
    const N = nextPow2(windowed.length);
    const re = new Array(N).fill(0);
    const im = new Array(N).fill(0);
    for (let i = 0; i < windowed.length; i++) re[i] = windowed[i];
    fft(re, im);
    const mags = [];
    const freqs = [];
    const nyquist = MUSE_SAMPLE_RATE_HZ / 2;
    for (let k = 0; k < N / 2; k++) {
        const freq = (k / N) * MUSE_SAMPLE_RATE_HZ;
        if (freq > MUSE_SPECTRO_MAX_FREQ) break;
        const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        const logMag = Math.log10(mag + 1e-6) * 10;
        freqs.push(freq.toFixed(1));
        mags.push(logMag);
    }
    return { freqs, mags };
}

function appendSpectrogramRow() {
    const now = Date.now();
    if (now - museLastSpectroTs < MUSE_SPECTRO_STEP_MS) return;
    const spectrum = computeFftFromRaw();
    if (!spectrum) return;
    updateMuseFftValue(spectrum);
    museLastSpectroTs = now;
    museSpectrogramRows.push({ timestamp: now, mags: spectrum.mags });
    if (museSpectrogramRows.length > MUSE_SPECTRO_MAX_ROWS) museSpectrogramRows.shift();
    drawSpectrogram();
}

function drawSpectrogram() {
    if (!museSpectrogramCanvas) return;
    const ctx = museSpectrogramCanvas.getContext('2d');
    const rect = museSpectrogramCanvas.getBoundingClientRect();
    museSpectrogramCanvas.width = rect.width;
    museSpectrogramCanvas.height = rect.height;
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!museSpectrogramRows.length) return;
    const cols = museSpectrogramRows.length;
    const rows = museSpectrogramRows[0].mags.length;
    let minVal = Infinity;
    let maxVal = -Infinity;
    museSpectrogramRows.forEach(r => {
        r.mags.forEach(v => {
            if (v != null && !Number.isNaN(v)) {
                minVal = Math.min(minVal, v);
                maxVal = Math.max(maxVal, v);
            }
        });
    });
    if (minVal === Infinity || maxVal === -Infinity) return;
    const cellW = rect.width / cols;
    const cellH = rect.height / rows;
    museSpectrogramRows.forEach((row, xIdx) => {
        row.mags.forEach((val, yIdx) => {
            const color = spectrogramColor(val, minVal, maxVal);
            ctx.fillStyle = color;
            ctx.fillRect(xIdx * cellW, rect.height - (yIdx + 1) * cellH, cellW, cellH);
        });
    });
}

function spectrogramColor(val, minVal, maxVal) {
    const t = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal + 1e-6)));
    // blue -> green -> red
    const r = Math.floor(255 * Math.max(0, t * 2 - 0));
    const g = Math.floor(255 * Math.min(1, t * 2));
    const b = Math.floor(255 * (1 - t));
    return `rgb(${r},${g},${b})`;
}

function applyHamming(arr) {
    const n = arr.length;
    return arr.map((v, i) => {
        const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
        return v * w;
    });
}

function nextPow2(n) {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
}

function fft(re, im) {
    const N = re.length;
    if (N <= 1) return;
    const evenRe = new Array(N / 2);
    const evenIm = new Array(N / 2);
    const oddRe = new Array(N / 2);
    const oddIm = new Array(N / 2);
    for (let i = 0; i < N / 2; i++) {
        evenRe[i] = re[2 * i];
        evenIm[i] = im[2 * i];
        oddRe[i] = re[2 * i + 1];
        oddIm[i] = im[2 * i + 1];
    }
    fft(evenRe, evenIm);
    fft(oddRe, oddIm);
    for (let k = 0; k < N / 2; k++) {
        const angle = (-2 * Math.PI * k) / N;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const tRe = cosA * oddRe[k] - sinA * oddIm[k];
        const tIm = sinA * oddRe[k] + cosA * oddIm[k];

        re[k] = evenRe[k] + tRe;
        im[k] = evenIm[k] + tIm;
        re[k + N / 2] = evenRe[k] - tRe;
        im[k + N / 2] = evenIm[k] - tIm;
    }
}

function setMuseView(view) {
    museCurrentView = view;
    if (museViewSelect) museViewSelect.value = view;
    if (view === 'raw') {
        museData.metric = 'eeg';
        if (museMetricSelect) museMetricSelect.value = 'eeg';
    } else if (view === 'absolute') {
        museData.metric = 'alphaAbsolute';
        if (museMetricSelect) museMetricSelect.value = 'alphaAbsolute';
    } else if (view === 'ppg') {
        museData.metric = 'ppg';
        if (museMetricSelect) museMetricSelect.value = 'ppg';
    } else if (view === 'optics') {
        museData.metric = 'optics';
        if (museMetricSelect) museMetricSelect.value = 'optics';
    } else if (view === 'battery') {
        museData.metric = 'battery';
        if (museMetricSelect) museMetricSelect.value = 'battery';
    }
    if (view === 'spectrogram' && museLegendEl) {
        museLegendEl.innerHTML = '';
    }
    redrawMuseChart();
}

function handleMuseDataMessage(msg) {
    const typeKey = museTypeKey(msg.packetTypeName) || museTypeKey(msg.packetType);
    const isSelectable = museSelectableMetrics.includes(typeKey);
    if (!museLabels[typeKey]) museLabels[typeKey] = typeKey;
    ensureMuseOption(typeKey);

    const ts = Date.now();
    const tsNum = normalizeMuseTimestamp(msg.timestamp ?? ts);
    let values = Array.isArray(msg.values)
        ? msg.values.map(v => Number(v)).filter(v => !Number.isNaN(v))
        : [];
    const rawValues = values.slice();

    if (!values.length) return;

    // Aggiorna batteria
    if (typeKey === 'battery' && values.length) {
        const pct = Math.max(0, Math.min(100, Number(values[0])));
        values = [pct];
        if (!Number.isNaN(pct)) {
            museBatteryPct = pct;
            if (museBatteryValueEl) museBatteryValueEl.textContent = `${pct.toFixed(0)}%`;
            if (museMode === 'live' && museBatteryBadge) museBatteryBadge.textContent = `${pct.toFixed(0)}%`;
            if (museBatteryEtaEl) museBatteryEtaEl.textContent = formatBatteryEta(pct);
        }
    }

    if (typeKey === 'accelerometer') {
        updateMuseMotion(values, tsNum);
    }
    const tsLabel = `${pad2(new Date(tsNum).getHours())}:${pad2(new Date(tsNum).getMinutes())}:${pad2(new Date(tsNum).getSeconds())}`;

    if (typeKey === 'eeg') {
        pushRawSample(tsNum, values, tsLabel);
    }
    if (['alphaAbsolute', 'betaAbsolute', 'thetaAbsolute', 'deltaAbsolute', 'gammaAbsolute'].includes(typeKey)) {
        const scaled = normalizeMuseBandValue(typeKey, rawValues);
        if (scaled != null) {
            values = [scaled];
            pushAbsoluteSample(typeKey, tsNum, tsLabel, scaled);
        } else {
            values = [];
        }
    }

    if (isSelectable) {
        if (typeKey === 'eeg') {
            museEegChannelCount = Math.max(museEegChannelCount, values.length);
        }
        updateMuseValueDisplay(typeKey, values);
        if (!museData.metric) {
            museData.metric = typeKey;
            if (museMetricSelect) {
                museMetricSelect.value = typeKey;
            }
            if (museChart) {
                const unit = museMetricConfig[typeKey]?.unit;
                const friendly = museLabels[typeKey] || typeKey;
                museChart.data.datasets[0].label = unit ? `${friendly} (${unit})` : friendly;
            }
        }
    }

    if (!isSelectable) return;

    const row = { timestamp: tsNum, timestampLabel: tsLabel, type: typeKey, values };
    if (rawValues.length && ['alphaAbsolute', 'betaAbsolute', 'thetaAbsolute', 'deltaAbsolute', 'gammaAbsolute'].includes(typeKey)) {
        row.rawValues = rawValues;
    }
    museRecordedData.push(row);
    if (museMode !== 'debug' && museRecordedData.length > 1000) museRecordedData.shift();

    // buffer per tipo (finestra corta per redraw rapido)
    if (!museBuffers[typeKey]) museBuffers[typeKey] = [];
    const typeBuffer = museBuffers[typeKey];
    let maxLen = (typeKey === 'eeg')
        ? MUSE_EEG_WINDOW_POINTS
        : (typeKey === 'battery' ? Infinity : MUSE_WINDOW_POINTS);
    if (museMode === 'debug') {
        maxLen = Infinity;
    }
    typeBuffer.push(row);
    if (maxLen !== Infinity && typeBuffer.length > maxLen) typeBuffer.shift();

    if (typeKey === 'eeg') {
        appendSpectrogramRow();
    }

    const nowTs = Date.now();
    let shouldRedraw = false;
    if (museCurrentView === 'spectrogram') {
        shouldRedraw = false;
    } else if (museCurrentView === 'raw' && typeKey === 'eeg') {
        shouldRedraw = nowTs - museLastRedrawTs >= MUSE_REDRAW_MS;
    } else if (museCurrentView === 'absolute' && ['alphaAbsolute', 'betaAbsolute', 'thetaAbsolute', 'deltaAbsolute', 'gammaAbsolute'].includes(typeKey)) {
        shouldRedraw = true;
    } else if (museCurrentView === 'fft' && typeKey === 'eeg') {
        shouldRedraw = nowTs - museLastRedrawTs >= MUSE_REDRAW_MS;
    } else if (museCurrentView === 'accelerometer' && typeKey === 'accelerometer') {
        shouldRedraw = true;
    } else if (museCurrentView === 'gyroscope' && typeKey === 'gyro') {
        shouldRedraw = true;
    } else if (museCurrentView === 'battery' && typeKey === 'battery') {
        shouldRedraw = true;
    } else if (typeKey === museData.metric) {
        shouldRedraw = nowTs - museLastRedrawTs >= MUSE_REDRAW_MS;
    }

    if (shouldRedraw) {
        museLastRedrawTs = nowTs;
        redrawMuseChart();
    }
}

function seedMuseFromCsvRows(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    Object.keys(museBuffers).forEach(k => { museBuffers[k] = []; });
    museRawBuffer.length = 0;
    museAbsoluteBuffer.length = 0;
    museAbsoluteState = null;
    museBandHistory = {};
    museSpectrogramRows.length = 0;
    museRecordedData = [];
    museEegChannelCount = 0;

    rows.forEach((row) => {
        if (!row) return;
        const typeKey = row.type;
        let values = Array.isArray(row.values)
            ? row.values.map(v => Number(v)).filter(v => !Number.isNaN(v))
            : [];
        if (!values.length || !typeKey) return;
        const tsNum = normalizeMuseTimestamp(row.timestamp);
        const tsLabel = `${pad2(new Date(tsNum).getHours())}:${pad2(new Date(tsNum).getMinutes())}:${pad2(new Date(tsNum).getSeconds())}`;
        const rawValues = Array.isArray(row.rawValues) && row.rawValues.length ? row.rawValues.slice() : values.slice();

        if (typeKey === 'battery' && values.length) {
            const pct = Math.max(0, Math.min(100, Number(values[0])));
            values = [pct];
            if (!Number.isNaN(pct)) {
                museBatteryPct = pct;
                if (museBatteryValueEl) museBatteryValueEl.textContent = `${pct.toFixed(0)}%`;
                if (museMode === 'live' && museBatteryBadge) museBatteryBadge.textContent = `${pct.toFixed(0)}%`;
                if (museBatteryEtaEl) museBatteryEtaEl.textContent = formatBatteryEta(pct);
            }
        }

        if (typeKey === 'accelerometer') {
            updateMuseMotion(values, tsNum);
        }
        if (typeKey === 'eeg') {
            museEegChannelCount = Math.max(museEegChannelCount, values.length);
            pushRawSample(tsNum, values, tsLabel);
        }
        if (['alphaAbsolute', 'betaAbsolute', 'thetaAbsolute', 'deltaAbsolute', 'gammaAbsolute'].includes(typeKey)) {
            const scaled = normalizeMuseBandValue(typeKey, rawValues);
            if (scaled != null) {
                values = [scaled];
                pushAbsoluteSample(typeKey, tsNum, tsLabel, scaled);
            } else {
                return;
            }
        }

        if (!museSelectableMetrics.includes(typeKey)) return;
        updateMuseValueDisplay(typeKey, values);

        const rowObj = { timestamp: tsNum, timestampLabel: tsLabel, type: typeKey, values };
        if (rawValues.length && ['alphaAbsolute', 'betaAbsolute', 'thetaAbsolute', 'deltaAbsolute', 'gammaAbsolute'].includes(typeKey)) {
            rowObj.rawValues = rawValues;
        }
        museRecordedData.push(rowObj);

        if (!museBuffers[typeKey]) museBuffers[typeKey] = [];
        museBuffers[typeKey].push(rowObj);
    });
}

function connectMuseWs() {
    const url = museEndpointEl ? museEndpointEl.textContent.trim() : 'ws://localhost:3002';
    try {
        museWs = new WebSocket(url);
        if (museStatusEl) museStatusEl.textContent = 'Connessione...';
        museWs.onopen = () => {
            setMuseStatus(true);
            setMuseChartControlsEnabled(true);
            startMuseMarkerCooldown();
            museConnectionStartTime = new Date();
            if (museConnectionTimeEl) {
                museConnectionTimeEl.textContent = `Dal: ${formatLocalTimestamp(museConnectionStartTime)}`;
            }
            if (museConnectButton) {
                museConnectButton.textContent = 'Disconnetti';
                museConnectButton.classList.add('disconnect');
            }
            if (museConnectionTimerId) clearInterval(museConnectionTimerId);
            museConnectionTimerId = setInterval(updateMuseElapsed, 1000);
            updateMuseElapsed();
            // reset chart on new session
            museRecordedData = [];
            Object.keys(museBuffers).forEach(k => { museBuffers[k] = []; });
            museRawBuffer.length = 0;
            museAbsoluteBuffer.length = 0;
            museAbsoluteState = null;
            museBandHistory = {};
            museSpectrogramRows.length = 0;
            museData.metric = 'eeg';
            museCurrentView = 'raw';
            if (museViewSelect) museViewSelect.value = 'raw';
            if (museMetricSelect) museMetricSelect.value = 'eeg';
            if (!museChart) {
                initMuseChart();
            }
            if (museChart && museChart.data.datasets?.[0]) {
                const unit = museMetricConfig[museData.metric]?.unit;
                const friendly = museLabels[museData.metric] || museData.metric;
                museChart.data.datasets[0].label = unit ? `${friendly} (${unit})` : friendly;
                if (museChart.options?.scales?.y?.title) {
                    museChart.options.scales.y.title.text = museChart.data.datasets[0].label;
                }
                museChart.data.labels = [];
                museChart.data.datasets[0].data = [];
                museChart.update();
            }
            resetMuseValues();
        };
        museWs.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                if (msg.type === 'data') {
                    handleMuseDataMessage(msg);
                } else if (msg.type === 'connection') {
                    if (msg.curr === 2 || msg.curr === 'connected') {
                        setMuseStatus(true);
                    }
                } else if (msg.type === 'muse_list') {
                    // no-op, could be used to show list
                }
            } catch (e) {
                console.error(e);
            }
        };
        museWs.onclose = () => {
            setMuseStatus(false);
            setMuseChartControlsEnabled(false);
            if (museConnectButton) {
                museConnectButton.textContent = 'Connetti';
                museConnectButton.classList.remove('disconnect');
            }
            if (museConnectionTimerId) clearInterval(museConnectionTimerId);
            museConnectionTimerId = null;
            museConnectionStartTime = null;
            if (museElapsedTimeEl) museElapsedTimeEl.textContent = '00:00:00';
            if (museConnectionTimeEl) museConnectionTimeEl.textContent = '';
        };
        museWs.onerror = (e) => {
            console.error(e);
        };
    } catch (e) {
        console.error(e);
    }
}

function disconnectMuse() {
    if (museWs) {
        museWs.close();
        museWs = null;
    }
    setMuseStatus(false);
    setMuseChartControlsEnabled(false);
    if (museConnectButton) {
        museConnectButton.textContent = 'Connetti';
        museConnectButton.classList.remove('disconnect');
    }
    if (museConnectionTimerId) clearInterval(museConnectionTimerId);
    museConnectionTimerId = null;
    museConnectionStartTime = null;
    if (museElapsedTimeEl) museElapsedTimeEl.textContent = '00:00:00';
    if (museConnectionTimeEl) museConnectionTimeEl.textContent = '';
    resetMuseValues();
}

function setMuseMode(mode) {
    if (mode === museMode) return;
    if (museMode === 'live' && mode === 'debug') {
        const confirmed = window.confirm('Passando alla modalità debug tutti i dati della sessione live verranno cancellati');
        if (!confirmed) return;
    } else if (museMode === 'debug' && mode === 'live') {
        const confirmed = window.confirm('Passando alla modalità live tutte le modifiche apportate al CSV verranno perse');
        if (!confirmed) return;
    }
    museMode = mode;
    museModeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.museMode === mode));
    if (museElapsedLabelEl) {
        museElapsedLabelEl.textContent = mode === 'debug' ? 'Durata totale' : 'Tempo trascorso';
    }
    if (mode === 'debug') {
        if (museConnectionTimeEl) museConnectionTimeEl.textContent = '';
        if (museElapsedTimeEl) museElapsedTimeEl.textContent = '00:00:00';
    }
    if (mode === 'live') {
        if (museLoadCsvButton) museLoadCsvButton.style.display = 'none';
        if (museConnectButton) museConnectButton.style.display = 'block';
        if (museConnectionTimeEl) museConnectionTimeEl.textContent = '';
        if (museElapsedTimeEl) museElapsedTimeEl.textContent = '00:00:00';
    } else {
        if (museConnectButton) museConnectButton.style.display = 'none';
        if (museLoadCsvButton) museLoadCsvButton.style.display = 'block';
        disconnectMuse();
    }
    if (mode === 'debug') {
        if (museStatusLed) museStatusLed.classList.remove('connected');
        if (museStatusEl) museStatusEl.textContent = 'Modalità debug';
    } else {
        setMuseStatus(false);
    }
    // Reset chart/data on mode switch
    museRecordedData = [];
    museData.metric = 'eeg';
    if (museMetricSelect) museMetricSelect.value = 'eeg';
    if (museChart) {
        if (!museChart.data.datasets.length) {
            museChart.data.datasets.push({
                label: '',
                data: [],
                borderColor: '#8e44ad',
                backgroundColor: 'rgba(142, 68, 173, 0.18)',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 1
            });
        }
        const unit = museMetricConfig[museData.metric]?.unit;
        const friendly = museLabels[museData.metric] || museData.metric;
        museChart.data.datasets[0].label = unit ? `${friendly} (${unit})` : friendly;
        if (museChart.options?.scales?.y?.title) {
            museChart.options.scales.y.title.text = museChart.data.datasets[0].label;
        }
        museChart.data.labels = [];
        museChart.data.datasets[0].data = [];
        museChart.update();
    }
    resetMuseValues();
    setMuseChartControlsEnabled(false);
    setMuseDropZoneVisible(false);
    setMuseViewOptionsVisibilityForDebug({ forceFirst: true });
    redrawMuseChart();
}

function loadMuseCsv(text) {
    resetMuseValues();
    museRecordedData = [];
    museData.labels = [];
    museData.values = [];
    museBandHistory = {};
    museRawBuffer.length = 0;
    museAbsoluteBuffer.length = 0;
    museAbsoluteState = null;
    museSpectrogramRows.length = 0;
    if (museElapsedLabelEl) museElapsedLabelEl.textContent = 'Durata totale';
    if (museConnectionTimeEl) museConnectionTimeEl.textContent = 'Da file CSV';
    const parsedRows = [];
    const recordParsedRow = (typeKey, tsNum, values, rawValues = null) => {
        if (!typeKey || !Array.isArray(values) || !values.length) return;
        parsedRows.push({
            type: typeKey,
            timestamp: tsNum,
            values: values.slice(),
            rawValues: Array.isArray(rawValues) ? rawValues.slice() : null
        });
    };
    let content = String(text || '');
    content = content.replace(/\u0000/g, '');
    if (!content.trim()) {
        reportMuseCsvIssue('CSV vuoto', 'CSV vuoto o non leggibile.');
        return;
    }
    const hasRealNewline = /[\r\n\u2028\u2029\u0085]/.test(content);
    if (!hasRealNewline && (content.includes('\\n') || content.includes('\\r'))) {
        content = content.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
    }
    content = content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u2028\u2029\u0085\u000b\u000c\u001e]/g, '\n');
    let lines = content.trim().split('\n');
    if (lines.length < 2) {
        const trimmed = content.trim();
        if (trimmed.startsWith('PK')) {
            reportMuseCsvIssue('CSV zip', 'Il file sembra uno ZIP. Estrai il CSV e riprova.');
            return;
        }
        const head = trimmed.slice(0, 120);
        console.warn('[Muse CSV] no lines', {
            length: trimmed.length,
            hasLF: trimmed.includes('\n'),
            hasCR: trimmed.includes('\r'),
            has2028: trimmed.includes('\u2028'),
            has2029: trimmed.includes('\u2029'),
            has0085: trimmed.includes('\u0085'),
            head
        });
        reportMuseCsvIssue('CSV senza righe dati', 'CSV senza righe dati.');
        return;
    }
    const headerLine = lines[0].replace(/^\\uFEFF/, '');
    const delimiter = detectCsvDelimiter(headerLine);
    const header = splitCsvLine(headerLine, delimiter).map(h => h.trim().replace(/^\"|\"$/g, ''));
    const headerLower = header.map(h => h.toLowerCase());
    const headerMap = new Map();
    headerLower.forEach((name, idx) => headerMap.set(name, idx));
    const getIdx = (name) => (headerMap.has(name) ? headerMap.get(name) : -1);
    const hasPacketType = headerMap.has('packettype');
    const hasFft = headerMap.has('freq_hz') && headerMap.has('power');
    const hasMindMonitor = headerMap.has('raw_tp9')
        || headerMap.has('delta_tp9')
        || headerMap.has('accelerometer_x')
        || headerMap.has('gyro_x')
        || headerMap.has('optics1');
    const hasTimestamp = headerMap.has('timestamp');
    if (!hasPacketType && !hasMindMonitor && !hasFft && !hasTimestamp) {
        reportMuseCsvIssue('Formato CSV non riconosciuto', 'Formato CSV Muse non riconosciuto');
        return;
    }
    const idxMarker = getIdx('marker');
    const markerByTs = new Map();
    const setMarker = (ts, cols) => {
        if (idxMarker === -1) return;
        const markerVal = (cols[idxMarker] || '').trim();
        if (!markerVal) return;
        markerByTs.set(ts, markerVal);
    };

    if (hasPacketType) {
        const idxTs = getIdx('timestamp');
        const idxType = getIdx('packettype');
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = splitCsvLine(line, delimiter);
            const tsRaw = idxTs !== -1 ? cols[idxTs] : '';
            const tsNum = normalizeMuseTimestamp(tsRaw);
            const typeCell = idxType !== -1 ? cols[idxType] : '';
            const typeNum = parseCsvNumber(typeCell);
            const typeKey = museTypeKey(Number.isFinite(typeNum) ? typeNum : typeCell);
            const startIdx = idxType !== -1 ? idxType + 1 : 2;
            const endIdx = idxMarker !== -1 ? idxMarker : cols.length;
            const valueCols = cols.slice(startIdx, endIdx);
            let values = valueCols.map(parseCsvNumber).filter(v => v != null);
            if (!values.length && valueCols.length === 1 && valueCols[0].includes(';')) {
                values = valueCols[0].split(';').map(parseCsvNumber).filter(v => v != null);
            }
            if (!values.length) {
                setMarker(tsNum, cols);
                continue;
            }
            recordParsedRow(typeKey, tsNum, values);
            setMarker(tsNum, cols);
        }
    } else if (hasMindMonitor) {
        const idxTs = getIdx('timestamp');
        const rawIdx = ['raw_tp9', 'raw_af7', 'raw_af8', 'raw_tp10'].map(getIdx);
        const auxIdx = getIdx('aux_1');
        const accIdx = ['accelerometer_x', 'accelerometer_y', 'accelerometer_z'].map(getIdx);
        const gyroIdx = ['gyro_x', 'gyro_y', 'gyro_z'].map(getIdx);
        const opticsIdx = Array.from({ length: 16 }, (_, i) => getIdx(`optics${i + 1}`));
        const batteryIdx = getIdx('battery');
        const bandDefs = [
            { key: 'deltaAbsolute', prefix: 'delta' },
            { key: 'thetaAbsolute', prefix: 'theta' },
            { key: 'alphaAbsolute', prefix: 'alpha' },
            { key: 'betaAbsolute', prefix: 'beta' },
            { key: 'gammaAbsolute', prefix: 'gamma' }
        ];
        const bandIdx = bandDefs.map(def => ['tp9', 'af7', 'af8', 'tp10'].map(ch => getIdx(`${def.prefix}_${ch}`)));
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = splitCsvLine(line, delimiter);
            const tsRaw = idxTs !== -1 ? cols[idxTs] : '';
            const tsNum = normalizeMuseTimestamp(tsRaw);

            if (rawIdx.some(idx => idx !== -1)) {
                const rawNumbers = rawIdx.map(idx => (idx !== -1 ? parseCsvNumber(cols[idx]) : null));
                const hasRaw = rawNumbers.some(v => v != null);
                if (hasRaw) {
                    const auxVal = auxIdx !== -1 ? parseCsvNumber(cols[auxIdx]) : null;
                    const values = [
                        ...rawNumbers.map(v => (v == null ? 0 : v)),
                        auxVal == null ? 0 : auxVal
                    ];
                    recordParsedRow('eeg', tsNum, values);
                }
            }

            bandDefs.forEach((def, idx) => {
                const colsIdx = bandIdx[idx];
                if (!colsIdx.some(i2 => i2 !== -1)) return;
                const bandVals = colsIdx.map(i2 => (i2 !== -1 ? parseCsvNumber(cols[i2]) : null));
                const hasBand = bandVals.some(v => v != null);
                if (!hasBand) return;
                const values = bandVals.map(v => (v == null ? 0 : v));
                recordParsedRow(def.key, tsNum, values, values);
            });

            if (accIdx.some(idx => idx !== -1)) {
                const accVals = accIdx.map(idx => (idx !== -1 ? parseCsvNumber(cols[idx]) : null));
                const hasAcc = accVals.some(v => v != null);
                if (hasAcc) {
                    const values = accVals.map(v => (v == null ? 0 : v));
                    recordParsedRow('accelerometer', tsNum, values);
                }
            }

            if (gyroIdx.some(idx => idx !== -1)) {
                const gyroVals = gyroIdx.map(idx => (idx !== -1 ? parseCsvNumber(cols[idx]) : null));
                const hasGyro = gyroVals.some(v => v != null);
                if (hasGyro) {
                    const values = gyroVals.map(v => (v == null ? 0 : v));
                    recordParsedRow('gyro', tsNum, values);
                }
            }

            if (opticsIdx.some(idx => idx !== -1)) {
                const opticsVals = opticsIdx.map(idx => (idx !== -1 ? parseCsvNumber(cols[idx]) : null));
                const hasOptics = opticsVals.some(v => v != null);
                if (hasOptics) {
                    const values = opticsVals.map(v => (v == null ? 0 : v));
                    recordParsedRow('optics', tsNum, values);
                }
            }

            if (batteryIdx !== -1) {
                const batteryVal = parseCsvNumber(cols[batteryIdx]);
                if (batteryVal != null) {
                    recordParsedRow('battery', tsNum, [batteryVal]);
                }
            }

            setMarker(tsNum, cols);
        }
    } else if (hasFft && !hasTimestamp) {
        alert('CSV FFT non supportato in modalità debug.');
        return;
    } else {
        const idxTs = getIdx('timestamp');
        const rawIdx = ['tp9', 'af7', 'af8', 'tp10', 'aux'].map(getIdx);
        const bandMap = {
            alphaAbsolute: getIdx('alpha_psd'),
            betaAbsolute: getIdx('beta_psd'),
            thetaAbsolute: getIdx('theta_psd'),
            deltaAbsolute: getIdx('delta_psd'),
            gammaAbsolute: getIdx('gamma_psd')
        };
        const accIdx = ['acc_x', 'acc_y', 'acc_z'].map(getIdx);
        const gyroIdx = ['gyro_x', 'gyro_y', 'gyro_z'].map(getIdx);
        const batteryIdx = getIdx('battery_pct');
        const ppgIdx = getIdx('ppg');
        const opticsIdx = getIdx('optics');

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = splitCsvLine(line, delimiter);
            const tsRaw = idxTs !== -1 ? cols[idxTs] : '';
            const tsNum = normalizeMuseTimestamp(tsRaw);

            if (rawIdx.some(idx => idx !== -1)) {
                const rawVals = rawIdx.map(idx => (idx !== -1 ? parseCsvNumber(cols[idx]) : null));
                const hasRaw = rawVals.some(v => v != null);
                if (hasRaw) {
                    const values = rawVals.map(v => (v == null ? 0 : v));
                    recordParsedRow('eeg', tsNum, values);
                }
            }

            Object.entries(bandMap).forEach(([key, idx]) => {
                if (idx === -1) return;
                const val = parseCsvNumber(cols[idx]);
                if (val == null) return;
                recordParsedRow(key, tsNum, [val], [val]);
            });

            if (accIdx.some(idx => idx !== -1)) {
                const accVals = accIdx.map(idx => (idx !== -1 ? parseCsvNumber(cols[idx]) : null));
                const hasAcc = accVals.some(v => v != null);
                if (hasAcc) {
                    const values = accVals.map(v => (v == null ? 0 : v));
                    recordParsedRow('accelerometer', tsNum, values);
                }
            }

            if (gyroIdx.some(idx => idx !== -1)) {
                const gyroVals = gyroIdx.map(idx => (idx !== -1 ? parseCsvNumber(cols[idx]) : null));
                const hasGyro = gyroVals.some(v => v != null);
                if (hasGyro) {
                    const values = gyroVals.map(v => (v == null ? 0 : v));
                    recordParsedRow('gyro', tsNum, values);
                }
            }

            if (batteryIdx !== -1) {
                const batteryVal = parseCsvNumber(cols[batteryIdx]);
                if (batteryVal != null) {
                    recordParsedRow('battery', tsNum, [batteryVal]);
                }
            }

            if (ppgIdx !== -1) {
                const ppgVal = parseCsvNumber(cols[ppgIdx]);
                if (ppgVal != null) {
                    recordParsedRow('ppg', tsNum, [ppgVal]);
                }
            }

            if (opticsIdx !== -1) {
                const opticsVal = parseCsvNumber(cols[opticsIdx]);
                if (opticsVal != null) {
                    recordParsedRow('optics', tsNum, [opticsVal]);
                }
            }

            setMarker(tsNum, cols);
        }
    }

    if (parsedRows.length) {
        seedMuseFromCsvRows(parsedRows);
    }

    if (markerByTs.size) {
        museMarkers = Array.from(markerByTs.entries()).map(([timestamp, label]) => ({
            timestamp,
            label
        }));
        let maxMarker = 0;
        markerByTs.forEach((label) => {
            const num = Number(label);
            if (Number.isFinite(num) && num > maxMarker) maxMarker = num;
        });
        museMarkerCounter = maxMarker + 1;
        const rowForTimestamp = new Map();
        museRecordedData.forEach((row) => {
            if (!row) return;
            const marker = markerByTs.get(row.timestamp);
            if (marker != null && marker !== '') {
                rowForTimestamp.set(row.timestamp, row);
            }
        });
        rowForTimestamp.forEach((row, timestamp) => {
            const marker = markerByTs.get(timestamp);
            if (marker != null && marker !== '') {
                row.marker = marker;
            }
        });
    }
    const typeSet = new Set(museRecordedData.map(row => row.type));
    const hasRaw = typeSet.has('eeg');
    const hasBands = ['alphaAbsolute', 'betaAbsolute', 'thetaAbsolute', 'deltaAbsolute', 'gammaAbsolute']
        .some(key => typeSet.has(key));
    const hasPpg = typeSet.has('ppg');
    const hasOptics = typeSet.has('optics');
    const hasAcc = typeSet.has('accelerometer');
    const hasGyro = typeSet.has('gyro');
    const hasBattery = typeSet.has('battery');
    const typeList = Array.from(typeSet).join('|');
    const summary = `CSV: ${museRecordedData.length} righe`;
    if (museMode === 'debug') {
        console.info('[Muse CSV]', summary, typeList);
    }

    let preferredView = museCurrentView;
    if (hasRaw) preferredView = 'raw';
    else if (hasBands) preferredView = 'absolute';
    else if (hasPpg) preferredView = 'ppg';
    else if (hasOptics) preferredView = 'optics';
    else if (hasAcc) preferredView = 'accelerometer';
    else if (hasGyro) preferredView = 'gyroscope';
    else if (hasBattery) preferredView = 'battery';
    if (museMode === 'debug') {
        setMuseViewOptionsVisibilityForDebug({ preferred: preferredView, forceFirst: true });
    } else {
        setMuseView(preferredView);
    }

    const bufferLen = getMuseBufferForView().length;
    const windowSize = getMuseWindowSizeForView();
    if (windowSize !== Infinity) {
        museDebugWindowStart = Math.max(0, bufferLen - windowSize);
    }
    if (!museRecordedData.length) {
        reportMuseCsvIssue('CSV senza dati compatibili', 'CSV Muse caricato ma senza dati compatibili.');
    }
    if (museElapsedTimeEl) {
        let minTs = null;
        let maxTs = null;
        museRecordedData.forEach(row => {
            if (typeof row.timestamp !== 'number' || Number.isNaN(row.timestamp)) return;
            if (minTs == null || row.timestamp < minTs) minTs = row.timestamp;
            if (maxTs == null || row.timestamp > maxTs) maxTs = row.timestamp;
        });
        if (minTs != null && maxTs != null && maxTs >= minTs) {
            museElapsedTimeEl.textContent = formatMuseDuration(maxTs - minTs);
        } else {
            museElapsedTimeEl.textContent = '00:00:00';
        }
    }
    setMuseChartControlsEnabled(museRecordedData.length > 0);
    redrawMuseChart();
}

function exportMuseCSV(mode, options = {}) {
    const { silent = false } = options;
    if (!museRecordedData.length) {
        if (!silent) {
            alert('Nessun dato Muse da esportare');
        }
        return null;
    }
    const markerByTs = new Map();
    museMarkers.forEach((marker) => {
        const ts = Number(marker?.timestamp);
        if (!Number.isFinite(ts)) return;
        markerByTs.set(String(ts), marker.label);
    });
    museRecordedData.forEach((row) => {
        if (row?.marker == null || row.marker === '') return;
        const ts = Number(row.timestamp);
        if (!Number.isFinite(ts)) return;
        markerByTs.set(String(ts), row.marker);
    });
    const getMarker = (ts) => {
        const key = String(Number(ts));
        return markerByTs.get(key) ?? '';
    };
    if (mode === 'current') {
        return exportMuseCurrentCSV({ silent, getMarker });
    }

    const maxValues = museRecordedData.reduce((max, row) => Math.max(max, row.values.length), 0);
    let header = 'timestamp,packetType';
    for (let i = 0; i < maxValues; i++) header += `,value${i + 1}`;
    header += ',marker\n';
    const rows = museRecordedData.map(row => {
        const tsLabel = formatMuseTimestamp(row.timestamp);
        const decimals = museMetricConfig[row.type]?.decimals ?? 2;
        const values = row.values.map(v => formatCsvValue(v, decimals));
        while (values.length < maxValues) values.push('');
        const marker = getMarker(row.timestamp);
        return `${tsLabel},${row.type},${values.join(',')},${marker}`;
    }).join('\n');
    return header + rows;
}

function exportMuseCurrentCSV(options = {}) {
    const { silent = false, getMarker = () => '' } = options;
    let header = '';
    let rows = '';

    if (museCurrentView === 'fft') {
        const spectrum = computeFftFromRaw();
        if (!spectrum?.freqs?.length) {
            if (!silent) {
                alert('Nessun dato FFT disponibile');
            }
            return false;
        }
        header = 'freq_hz,power,marker\n';
        rows = spectrum.freqs.map((f, idx) => {
            const mag = spectrum.mags[idx];
            return `${f},${formatCsvValue(mag, museMetricConfig.fft?.decimals ?? 2)},`;
        }).join('\n');
    } else if (museCurrentView === 'raw') {
        const eegRows = museRecordedData.filter(r => r.type === 'eeg');
        const channelCount = museEegChannelNames.length;
        header = `timestamp,${museEegChannelNames.join(',')},marker\n`;
        rows = eegRows.map(r => {
            const tsLabel = formatMuseTimestamp(r.timestamp);
            const values = normalizeValueArray(r.values, channelCount)
                .map(v => formatCsvValue(v, museMetricConfig.eeg?.decimals ?? 2));
            return `${tsLabel},${values.join(',')},${getMarker(r.timestamp)}`;
        }).join('\n');
    } else if (museCurrentView === 'absolute') {
        const bandKeys = ['alphaAbsolute', 'betaAbsolute', 'thetaAbsolute', 'deltaAbsolute', 'gammaAbsolute'];
        const bandRows = new Map();
        museRecordedData.forEach(r => {
            if (!bandKeys.includes(r.type)) return;
            const key = r.timestamp;
            const entry = bandRows.get(key) || { timestamp: r.timestamp, values: {} };
            entry.values[r.type] = r.values?.[0] ?? null;
            bandRows.set(key, entry);
        });
        const sorted = Array.from(bandRows.values()).sort((a, b) => a.timestamp - b.timestamp);
        header = 'timestamp,alpha_psd,beta_psd,theta_psd,delta_psd,gamma_psd,marker\n';
        rows = sorted.map(entry => {
            const tsLabel = formatMuseTimestamp(entry.timestamp);
            const values = bandKeys.map(key => formatCsvValue(entry.values[key], museMetricConfig[key]?.decimals ?? 2));
            return `${tsLabel},${values.join(',')},${getMarker(entry.timestamp)}`;
        }).join('\n');
    } else if (museCurrentView === 'accelerometer' || museCurrentView === 'gyroscope') {
        const key = museCurrentView === 'accelerometer' ? 'accelerometer' : 'gyro';
        const rowsData = museRecordedData.filter(r => r.type === key);
        header = museCurrentView === 'accelerometer'
            ? 'timestamp,acc_x,acc_y,acc_z,marker\n'
            : 'timestamp,gyro_x,gyro_y,gyro_z,marker\n';
        const decimals = museMetricConfig[key]?.decimals ?? 2;
        rows = rowsData.map(r => {
            const tsLabel = formatMuseTimestamp(r.timestamp);
            const values = normalizeValueArray(r.values, 3).map(v => formatCsvValue(v, decimals));
            return `${tsLabel},${values.join(',')},${getMarker(r.timestamp)}`;
        }).join('\n');
    } else {
        let metricKey = museData.metric || 'eeg';
        if (museCurrentView === 'ppg') metricKey = 'ppg';
        if (museCurrentView === 'optics') metricKey = 'optics';
        if (museCurrentView === 'battery') metricKey = 'battery';
        const rowsData = museRecordedData.filter(r => r.type === metricKey);
        const decimals = museMetricConfig[metricKey]?.decimals ?? 2;
        const columnLabel = metricKey === 'battery' ? 'battery_pct' : metricKey;
        header = `timestamp,${columnLabel},marker\n`;
        rows = rowsData.map(r => {
            const tsLabel = formatMuseTimestamp(r.timestamp);
            const val = museChartValue(r.values);
            return `${tsLabel},${formatCsvValue(val, decimals)},${getMarker(r.timestamp)}`;
        }).join('\n');
    }

    if (!rows) {
        if (!silent) {
            alert('Nessun dato disponibile per il grafico corrente');
        }
        return null;
    }
    return header + rows;
}

function exportMuseMindMonitorCSV(options = {}) {
    const { silent = false } = options;
    if (!museRecordedData.length) {
        if (!silent) {
            alert('Nessun dato Muse da esportare');
        }
        return false;
    }
    const markerByTs = new Map();
    museMarkers.forEach((marker) => {
        const ts = Number(marker?.timestamp);
        if (!Number.isFinite(ts)) return;
        markerByTs.set(String(ts), marker.label);
    });
    museRecordedData.forEach((row) => {
        if (row?.marker == null || row.marker === '') return;
        const ts = Number(row.timestamp);
        if (!Number.isFinite(ts)) return;
        markerByTs.set(String(ts), row.marker);
    });
    const channelLabels = ['TP9', 'AF7', 'AF8', 'TP10'];
    const bandDefs = [
        { key: 'deltaAbsolute', label: 'Delta' },
        { key: 'thetaAbsolute', label: 'Theta' },
        { key: 'alphaAbsolute', label: 'Alpha' },
        { key: 'betaAbsolute', label: 'Beta' },
        { key: 'gammaAbsolute', label: 'Gamma' }
    ];
    const bandHeaders = bandDefs.flatMap(def => channelLabels.map(ch => `${def.label}_${ch}`));
    const rawHeaders = channelLabels.map(ch => `RAW_${ch}`);
    const auxHeaders = ['AUX_1', 'AUX_2', 'AUX_3', 'AUX_4'];
    const accHeaders = ['Accelerometer_X', 'Accelerometer_Y', 'Accelerometer_Z'];
    const gyroHeaders = ['Gyro_X', 'Gyro_Y', 'Gyro_Z'];
    const opticsHeaders = Array.from({ length: 16 }, (_, i) => `Optics${i + 1}`);
    const hsiHeaders = channelLabels.map(ch => `HSI_${ch}`);
    const header = [
        'TimeStamp',
        ...bandHeaders,
        ...rawHeaders,
        ...auxHeaders,
        ...accHeaders,
        ...gyroHeaders,
        ...opticsHeaders,
        'Heart_Rate',
        'HeadBandOn',
        ...hsiHeaders,
        'Battery',
        'Elements',
        'Marker'
    ].join(',') + '\n';

    const last = {
        bands: Object.fromEntries(bandDefs.map(def => [def.key, new Array(channelLabels.length).fill(null)])),
        accelerometer: new Array(3).fill(null),
        gyro: new Array(3).fill(null),
        optics: new Array(16).fill(null),
        battery: null,
        heartRate: null,
        headbandOn: null,
        hsi: new Array(channelLabels.length).fill(null),
        elements: ''
    };

    const rows = [];
    let hasEeg = false;

    museRecordedData.forEach((row) => {
        if (row.type === 'accelerometer') {
            last.accelerometer = normalizeValueArray(row.values, 3);
            return;
        }
        if (row.type === 'gyro') {
            last.gyro = normalizeValueArray(row.values, 3);
            return;
        }
        if (row.type === 'optics') {
            last.optics = normalizeValueArray(row.values, 16);
            return;
        }
        if (row.type === 'battery') {
            last.battery = row.values?.[0] ?? null;
            return;
        }
        if (bandDefs.some(def => def.key === row.type)) {
            let bandValues = (Array.isArray(row.rawValues) && row.rawValues.length)
                ? row.rawValues
                : row.values;
            if (Array.isArray(bandValues) && bandValues.length === 1) {
                bandValues = new Array(channelLabels.length).fill(bandValues[0]);
            }
            last.bands[row.type] = normalizeValueArray(bandValues, channelLabels.length);
            return;
        }
        if (row.type === 'eeg') {
            hasEeg = true;
            const tsLabel = formatMuseTimestampMs(row.timestamp);
            const rawValues = normalizeValueArray(row.values, channelLabels.length + 1);
            const rawMain = rawValues.slice(0, channelLabels.length).map(v => formatCsvValue(v));
            const auxValues = [rawValues[channelLabels.length], null, null, null].map(v => formatCsvValue(v));
            const bandValues = bandDefs.flatMap(def => normalizeValueArray(last.bands[def.key], channelLabels.length).map(v => formatCsvValue(v)));
            const accValues = normalizeValueArray(last.accelerometer, 3).map(v => formatCsvValue(v));
            const gyroValues = normalizeValueArray(last.gyro, 3).map(v => formatCsvValue(v));
            const opticsValues = normalizeValueArray(last.optics, 16).map(v => formatCsvValue(v));
            const hrVal = formatCsvValue(last.heartRate);
            const headbandVal = formatCsvValue(last.headbandOn);
            const hsiValues = normalizeValueArray(last.hsi, channelLabels.length).map(v => formatCsvValue(v));
            const batteryVal = formatCsvValue(last.battery);
            const elementsVal = last.elements || '';
            const markerVal = markerByTs.get(String(row.timestamp)) ?? '';
            rows.push([
                tsLabel,
                ...bandValues,
                ...rawMain,
                ...auxValues,
                ...accValues,
                ...gyroValues,
                ...opticsValues,
                hrVal,
                headbandVal,
                ...hsiValues,
                batteryVal,
                elementsVal,
                markerVal
            ].join(','));
        }
    });

    if (!hasEeg) {
        if (!silent) {
            alert('Nessun dato EEG per l\'export Mind Monitor');
        }
        return null;
    }

    return header + rows.join('\n');
}

function downloadMuseCsvBundle() {
    if (!museRecordedData.length) {
        alert('Nessun dato Muse da esportare');
        return;
    }
    const currentContent = exportMuseCSV('current');
    if (!currentContent) return;
    const fullContent = exportMuseCSV('all', { silent: true });
    const legacyContent = exportMuseMindMonitorCSV();
    if (!fullContent || !legacyContent) return;
    const sessionId = getNextMuseSessionId();
    const dateStr = formatFileTimestamp(new Date());
    const baseName = `session${sessionId}-${dateStr}-muse`;
    const viewLabel = slugifyLabel(getMuseViewLabel()) || museCurrentView || 'current';
    const zipBlob = createZipBlob([
        { name: `${baseName}-full.csv`, content: fullContent },
        { name: `${baseName}-${viewLabel}.csv`, content: currentContent },
        { name: `${baseName}-legacy.csv`, content: legacyContent }
    ]);
    downloadBlob(zipBlob, `${baseName}.zip`);
}

async function readMuseCsvFile(file) {
    if (!file) return;
    try {
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
            reportMuseCsvIssue('CSV vuoto', 'CSV vuoto o non leggibile.');
            return;
        }
        loadMuseCsv(text);
    } catch (err) {
        console.error(err);
        alert('Errore nella lettura del file CSV.');
    }
}

// Event wiring Muse
if (museConnectButton) {
    museConnectButton.addEventListener('click', () => {
        if (museWs) {
            const confirmed = window.confirm('Disconnettendo il sensore i dati rimarranno visibili ma non saranno più in tempo reale');
            if (!confirmed) return;
            disconnectMuse();
        } else {
            connectMuseWs();
        }
    });
}
if (museModeButtons && museModeButtons.length) {
    museModeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.museMode;
            setMuseMode(mode);
        });
    });
}
if (museLoadCsvButton) {
    museLoadCsvButton.addEventListener('click', () => {
    if (!ensureMuseDebugMode()) return;
    if (museCsvInput) {
        museCsvInput.value = '';
        museCsvInput.click();
    }
});
}
if (museCsvInput) {
    museCsvInput.addEventListener('change', (e) => {
        if (!ensureMuseDebugMode()) return;
        const file = e.target.files[0];
        if (!file) return;
        readMuseCsvFile(file);
        museCsvInput.value = '';
    });
}
if (museDownloadButton) {
    museDownloadButton.addEventListener('click', downloadMuseCsvBundle);
}
if (museMarkerButton) {
    museMarkerButton.addEventListener('click', addMuseMarker);
}
if (museChartScrollInput) {
    museChartScrollInput.addEventListener('input', () => {
        museDebugWindowStart = Number(museChartScrollInput.value) || 0;
        redrawMuseChart();
    });
}
if (museMetricSelect) {
    museMetricSelect.addEventListener('change', () => {
        museData.metric = museMetricSelect.value;
        if (museChart) {
            const unit = museMetricConfig[museData.metric]?.unit;
            const friendly = museLabels[museData.metric] || museData.metric;
            museChart.data.datasets[0].label = unit ? `${friendly} (${unit})` : friendly;
            if (museChart.options?.scales?.y?.title) {
                museChart.options.scales.y.title.text = museChart.data.datasets[0].label;
            }
        }
        redrawMuseChart();
    });
}
if (museViewSelect) {
    museViewSelect.addEventListener('change', () => {
        setMuseView(museViewSelect.value);
    });
}
if (museChartContainer) {
    ['dragenter', 'dragover'].forEach(evt => {
        museChartContainer.addEventListener(evt, (e) => {
            if (museMode !== 'debug') return;
            if (!e.dataTransfer || !e.dataTransfer.items || e.dataTransfer.items.length === 0) return;
            e.preventDefault();
            setMuseDropZoneVisible(true);
        });
    });
    ['dragleave', 'drop'].forEach(evt => {
        museChartContainer.addEventListener(evt, (e) => {
            if (evt === 'dragleave' && e.currentTarget.contains(e.relatedTarget)) return;
            setMuseDropZoneVisible(false);
        });
    });
    museChartContainer.addEventListener('drop', (e) => {
        if (!ensureMuseDebugMode()) return;
        e.preventDefault();
        setMuseDropZoneVisible(false);
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        readMuseCsvFile(file);
    });
}
window.addEventListener('resize', () => {
    drawMuseMarkerOverlay();
});

// Init charts and default state; guard so a missing symbol doesn't block other modules
function initMuseModule() {
    if (typeof initMuseChart === 'function') {
        initMuseChart();
    }
    if (typeof setMuseMode === 'function') {
        setMuseMode('live');
    }
    setMuseView('raw');
    if (museMetricSelect) museMetricSelect.style.display = 'none';
    if (museLoadCsvButton) museLoadCsvButton.style.display = 'none';
    if (museConnectButton) museConnectButton.style.display = 'block';
    setMuseChartControlsEnabled(false);
    if (museMetricsCard) {
        museMetricsCard.classList.remove('info-open');
    }
}

try {
    initMuseModule();
} catch (err) {
    console.error('Muse init failed', err);
}
