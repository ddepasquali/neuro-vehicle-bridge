// Riferimenti agli elementi HTML
const connectButton = document.getElementById('connectButton');
const loadCsvButton = document.getElementById('loadCsvButton');
const csvInput = document.getElementById('csvInput');
const modeButtons = document.querySelectorAll('.mode-btn');
const pauseButton = document.getElementById('pauseButton');
const exportAllButton = document.getElementById('exportAllButton');
const exportCurrentButton = document.getElementById('exportCurrentButton');
const metricSelect = document.getElementById('metricSelect');
const windowSelect = document.getElementById('windowSelect');
const paramControls = document.getElementById('paramControls');
const outlierAbsSelect = document.getElementById('outlierAbsSelect');
const outlierRelSelect = document.getElementById('outlierRelSelect');
const resampleSelect = document.getElementById('resampleSelect');
const moreButton = document.getElementById('moreButton');
const exportMenu = document.getElementById('exportMenu');
const settingsButton = document.getElementById('settingsButton');
const settingsMenu = document.getElementById('settingsMenu');
const resetDataButton = document.getElementById('resetDataButton');
const obdConnectButton = document.getElementById('obdConnectButton');
const obdLoadCsvButton = document.getElementById('obdLoadCsvButton');
const obdCsvInput = document.getElementById('obdCsvInput');
const obdMoreButton = document.getElementById('obdMoreButton');
const obdExportMenu = document.getElementById('obdExportMenu');
const obdExportAllButton = document.getElementById('obdExportAllButton');
const obdExportCurrentButton = document.getElementById('obdExportCurrentButton');
const obdStatusEl = document.getElementById('obdStatus');
const obdRpmEl = document.getElementById('obdRpm');
const obdSpeedEl = document.getElementById('obdSpeed');
const obdCoolantEl = document.getElementById('obdCoolant');
const obdMetricSelect = document.getElementById('obdMetricSelect');
const obdRpmCardEl = document.getElementById('obdRpmCard');
const obdSpeedCardEl = document.getElementById('obdSpeedCard');
const obdSpeedMaxEl = document.getElementById('obdSpeedMax');
const obdCoolantCardEl = document.getElementById('obdCoolantCard');
const obdElapsedTimeEl = document.getElementById('obdElapsedTime');
const obdModeButtons = document.querySelectorAll('.mode-btn-obd');
const statusLed = document.getElementById('statusLed');
const obdStatusLed = document.getElementById('obdStatusLed');
const statoEl = document.getElementById('stato');
const connectionTimeEl = document.getElementById('connectionTime');
const elapsedTimeEl = document.getElementById('elapsedTime');
const elapsedLabelEl = document.getElementById('elapsedLabel');
const bpmValueEl = document.getElementById('bpmValue');
const rrValueEl = document.getElementById('rrValue');
const maxBpmValueEl = document.getElementById('maxBpmValue');
const maxBpmTimeEl = document.getElementById('maxBpmTime');
const minBpmValueEl = document.getElementById('minBpmValue');
const minBpmTimeEl = document.getElementById('minBpmTime');

const rmssdValueEl = document.getElementById('rmssdValue');
const sdnnValueEl = document.getElementById('sdnnValue');
const nn50ValueEl = document.getElementById('nn50Value');
const pnn50ValueEl = document.getElementById('pnn50Value');
const lfhfValueEl = document.getElementById('lfhfValue');
const lfhfRawValueEl = document.getElementById('lfhfRawValue');
const lfPowerValueEl = document.getElementById('lfPowerValue');
const hfPowerValueEl = document.getElementById('hfPowerValue');
const windowQualityValueEl = document.getElementById('windowQualityValue');
const hrvIndexValueEl = document.getElementById('hrvIndexValue');

function updateLiveIndicator() {
    // Indicator removed from UI; keep no-op for legacy calls.
}


// Muse elements
const museConnectButton = document.getElementById('museConnectButton');
const museLoadCsvButton = document.getElementById('museLoadCsvButton');
const museCsvInput = document.getElementById('museCsvInput');
const museModeButtons = document.querySelectorAll('.mode-btn-muse');
const museStatusLed = document.getElementById('museStatusLed');
const museStatusEl = document.getElementById('museStatus');
const museElapsedTimeEl = document.getElementById('museElapsedTime');
const museEndpointEl = document.getElementById('museEndpoint');
const museMetricSelect = document.getElementById('museMetricSelect');
const museMoreButton = document.getElementById('museMoreButton');
const museExportMenu = document.getElementById('museExportMenu');
const museExportAllButton = document.getElementById('museExportAllButton');
const museExportCurrentButton = document.getElementById('museExportCurrentButton');
const museBatteryValueEl = document.getElementById('museBatteryValue');
const museLegendEl = document.getElementById('museLegend');
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

function updateObdIndicator(isLive) {
    if (!obdStatusLed) return;
    if (isLive) {
        obdStatusLed.style.backgroundColor = '#34c759';
        obdStatusLed.style.boxShadow = '0 0 0 4px rgba(52, 199, 89, 0.25)';
    } else {
        obdStatusLed.style.backgroundColor = 'rgba(60, 60, 67, 0.35)';
        obdStatusLed.style.boxShadow = '0 0 0 2px rgba(60, 60, 67, 0.15)';
    }
}

// UUID Servizi BLE
const HR_SERVICE_UUID = 'heart_rate';
const HR_MEASUREMENT_CHAR_UUID = 'heart_rate_measurement';

// Numero massimo di punti dati da mostrare sul grafico (per farlo "scorrere")
const MAX_DATA_POINTS = 100;

let isPaused = false;
let recordedData = [];
let connectionStartTime = null;
let connectionTimerId = null;
let maxBpm = null;
let maxBpmTimestamp = null;
let minBpm = null;
let minBpmTimestamp = null;

let rrSeries = []; // serie degli intervalli R-R (ms) per il calcolo HRV
let isConnected = false;
let connectedDevice = null;
let currentMetric = 'rr'; // 'rr', 'bpm', 'rmssd', 'sdnn', 'pnn50', 'hrvIndex', 'spectrum'
let currentMode = 'live'; // 'live' per BLE, 'debug' per CSV
let lfhfWindowSeconds = 120; // finestra per spettro LF/HF
const rrMaxBuffer = 300;
let outlierAbsMs = 200;
let outlierRel = 0.2;
let resampleHz = 4;
const lfhfSmoothingWindow = 3;
let lfhfHistory = [];
let obdWs = null;
let obdPollTimer = null;
let obdHelpers = null;
const OBD_PIDS = ['010C', '010D', '0105']; // RPM, speed, coolant
let obdChart = null;
let obdData = {
    labels: [],
    values: [],
    metric: 'rpm',
    speedMax: null
};
let obdConnectionStartTime = null;
let obdConnectionTimerId = null;
let obdMode = 'live';
let obdRecordedData = [];

// Muse state
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
let museEegChannelCount = 0;
const MUSE_WINDOW_POINTS = 80; // finestra mobile breve e costante
const MUSE_CHART_MAX_POINTS = MUSE_WINDOW_POINTS;
const MUSE_EEG_WINDOW_POINTS = MUSE_WINDOW_POINTS;
const MUSE_EEG_CLAMP = 100; // ±100 µV tipico per visualizzazione clinica
const MUSE_EEG_OFFSET = 40; // offset visivo per separare i canali
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
    eeg: 'EEG',
    alphaAbsolute: 'Alpha abs',
    betaAbsolute: 'Beta abs',
    thetaAbsolute: 'Theta abs',
    deltaAbsolute: 'Delta abs',
    gammaAbsolute: 'Gamma abs',
    ppg: 'PPG',
    optics: 'Optics',
    isHeartGood: 'Heart quality',
    accelerometer: 'Accelerometer',
    gyro: 'Gyro',
    battery: 'Battery'
};
const museMetricConfig = {
    eeg: { unit: 'µV', decimals: 2 },
    alphaAbsolute: { unit: 'µV', decimals: 2 },
    betaAbsolute: { unit: 'µV', decimals: 2 },
    thetaAbsolute: { unit: 'µV', decimals: 2 },
    deltaAbsolute: { unit: 'µV', decimals: 2 },
    gammaAbsolute: { unit: 'µV', decimals: 2 },
    ppg: { unit: 'a.u.', decimals: 2 },
    optics: { unit: 'a.u.', decimals: 2 }
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

import('../lib/obd.js').then(mod => {
    obdHelpers = mod;
}).catch(err => {
    console.error('Impossibile caricare helpers OBD', err);
});
function initObdChart() {
    const ctxObd = document.getElementById('obdChart').getContext('2d');
    obdChart = new Chart(ctxObd, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'RPM',
                data: [],
                borderColor: '#0a84ff',
                backgroundColor: 'rgba(10, 132, 255, 0.16)',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { color: 'rgba(60,60,67,0.7)' }
                },
                y: {
                    display: true,
                    min: 0,
                    max: 7000,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { color: 'rgba(60,60,67,0.7)' },
                    title: { display: true, text: 'RPM', color: 'rgba(60,60,67,0.7)' }
                }
            },
            plugins: { legend: { display: false } },
            animation: false
        }
    });
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
            scales: {
                x: {
                    display: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { color: 'rgba(60,60,67,0.7)', autoSkip: true, maxTicksLimit: 6 }
                },
                y: {
                    display: true,
                    min: -MUSE_EEG_CLAMP,
                    max: MUSE_EEG_CLAMP,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { color: 'rgba(60,60,67,0.7)' },
                    title: { display: true, text: 'EEG (µV)', color: 'rgba(60,60,67,0.7)' }
                }
            },
            plugins: { legend: { display: false } },
            animation: false
        }
    });
}

function updateChartStyleForMetric() {
    let borderColor = '#0a84ff';
    let backgroundColor = 'rgba(10, 132, 255, 0.16)';

    switch (currentMetric) {
        case 'rr':
            borderColor = '#0a84ff'; // blu come Intervallo R-R
            backgroundColor = 'rgba(10, 132, 255, 0.16)';
            break;
        case 'bpm':
            borderColor = '#ff3b30'; // rosso come cuore
            backgroundColor = 'rgba(255, 59, 48, 0.16)';
            break;
        case 'rmssd':
        case 'sdnn':
        case 'pnn50':
        case 'hrvIndex':
            borderColor = '#34c759'; // verde come icona scientifica
            backgroundColor = 'rgba(52, 199, 89, 0.16)';
            break;
        case 'spectrum':
            borderColor = '#8e44ad'; // viola per spettro
            backgroundColor = 'rgba(142, 68, 173, 0.18)';
            break;
    }

    heartRateChart.data.datasets[0].borderColor = borderColor;
    heartRateChart.data.datasets[0].backgroundColor = backgroundColor;
}

function clearMeasurementData() {
    recordedData = [];
    rrSeries = [];
    resetHrvMetrics();

    maxBpm = null;
    maxBpmTimestamp = null;
    minBpm = null;
    minBpmTimestamp = null;

    bpmValueEl.textContent = '--';
    rrValueEl.textContent = '--';
    elapsedTimeEl.textContent = '00:00:00';
    maxBpmValueEl.textContent = '--';
    maxBpmTimeEl.textContent = '--';
    minBpmValueEl.textContent = '--';
    minBpmTimeEl.textContent = '--';

    heartRateChart.data.labels = [];
    heartRateChart.data.datasets[0].data = [];
    heartRateChart.update();
}

updateLiveIndicator(false);

function updateParamControlsVisibility() {
    const isHrvMetric = ['rmssd', 'sdnn', 'pnn50', 'hrvIndex', 'spectrum'].includes(currentMetric);
    if (paramControls) paramControls.style.display = isHrvMetric ? 'flex' : 'none';
    if (settingsButton) settingsButton.style.display = isHrvMetric ? 'flex' : 'none';
    if (settingsMenu && !isHrvMetric) {
        settingsMenu.classList.remove('open');
        if (settingsButton) settingsButton.setAttribute('aria-expanded', 'false');
    }
}

metricSelect.addEventListener('change', () => {
    currentMetric = metricSelect.value;
    redrawChartForMetric();
    updateParamControlsVisibility();
});
windowSelect.addEventListener('change', () => {
    const val = Number(windowSelect.value);
    if (!Number.isNaN(val) && val > 0) {
        lfhfWindowSeconds = val;
        updateHrvMetrics();
        redrawChartForMetric();
    }
});
outlierAbsSelect.addEventListener('change', () => {
    const val = Number(outlierAbsSelect.value);
    if (!Number.isNaN(val) && val > 0) {
        outlierAbsMs = val;
        recomputeMetricsForRecordedData();
        updateHrvMetrics();
        redrawChartForMetric();
    }
});
outlierRelSelect.addEventListener('change', () => {
    const val = Number(outlierRelSelect.value);
    if (!Number.isNaN(val) && val > 0) {
        outlierRel = val;
        recomputeMetricsForRecordedData();
        updateHrvMetrics();
        redrawChartForMetric();
    }
});
resampleSelect.addEventListener('change', () => {
    const val = Number(resampleSelect.value);
    if (!Number.isNaN(val) && val > 0) {
        resampleHz = val;
        recomputeMetricsForRecordedData();
        updateHrvMetrics();
        redrawChartForMetric();
    }
});

updateParamControlsVisibility();

function pad2(num) {
    return num.toString().padStart(2, '0');
}

function formatLocalTimestamp(date) {
    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    const d = pad2(date.getDate());
    const h = pad2(date.getHours());
    const mi = pad2(date.getMinutes());
    const s = pad2(date.getSeconds());
    return `${y}-${m}-${d} ${h}:${mi}:${s}`;
}

function parseTimestampString(ts) {
    // atteso formato "YYYY-MM-DD HH:MM:SS"
    if (!ts) return null;
    const parts = ts.split(' ');
    if (parts.length !== 2) return null;
    const datePart = parts[0];
    const timePart = parts[1];
    const dParts = datePart.split('-').map(Number);
    const tParts = timePart.split(':').map(Number);
    if (dParts.length !== 3 || tParts.length !== 3) return null;
    const [year, month, day] = dParts;
    const [hour, minute, second] = tParts;
    if ([year, month, day, hour, minute, second].some(v => Number.isNaN(v))) return null;
    return new Date(year, month - 1, day, hour, minute, second);
}

function extractTimeLabel(ts) {
    if (!ts) return '';
    // Se è un numero, convertilo in HH:MM:SS locale
    if (typeof ts === 'number') {
        const d = new Date(ts);
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    }
    if (typeof ts !== 'string') return '';
    const parts = ts.split(' ');
    if (parts.length !== 2) return ts;
    return parts[1]; // restituisce "HH:MM:SS"
}

function getWindowedRrSeries(windowSeconds) {
    if (!recordedData.length) return [];
    const now = currentMode === 'debug'
        ? parseTimestampString(recordedData[recordedData.length - 1].timestamp)
        : new Date();
    if (!now) return rrSeries.slice();

    const windowStart = now.getTime() - windowSeconds * 1000;
    const windowed = [];
    for (let i = recordedData.length - 1; i >= 0; i--) {
        const row = recordedData[i];
        if (row.rr_ms == null || Number.isNaN(row.rr_ms)) continue;
        const tsDate = parseTimestampString(row.timestamp);
        if (!tsDate) continue;
        const tsMs = tsDate.getTime();
        if (tsMs < windowStart) break;
        windowed.push(row.rr_ms);
    }
    return windowed.reverse();
}

function recomputeMetricsForRecordedData() {
    if (!recordedData.length) return;
    lfhfHistory = [];
    const windowBuffer = [];
    const updated = [];

    for (let i = 0; i < recordedData.length; i++) {
        const row = { ...recordedData[i] };
        const tsDate = parseTimestampString(row.timestamp);
        if (!tsDate) {
            updated.push(row);
            continue;
        }
        // rimuovi RR fuori finestra
        while (windowBuffer.length && (tsDate - windowBuffer[0].ts) > lfhfWindowSeconds * 1000) {
            windowBuffer.shift();
        }
        if (row.rr_ms != null && !Number.isNaN(row.rr_ms)) {
            windowBuffer.push({ ts: tsDate, rr: row.rr_ms });
        }
        const windowSeries = windowBuffer.map(x => x.rr);
        const metrics = computeHrvMetricsFromSeries(windowSeries);
        if (metrics) {
            row.rmssd = metrics.rmssd;
            row.sdnn = metrics.sdnn;
            row.pnn50 = metrics.pnn50;
            row.hrvIndex = metrics.hrvIndex;
            row.lfhf = metrics.lfhf;
            row.lfPower = metrics.spectrum ? metrics.spectrum.lfPower : null;
            row.hfPower = metrics.spectrum ? metrics.spectrum.hfPower : null;
            row.windowQualityPct = metrics.rejectedPct != null ? (100 - metrics.rejectedPct) : null;
            if (metrics.lfhf != null && !Number.isNaN(metrics.lfhf)) {
                lfhfHistory.push(metrics.lfhf);
                if (lfhfHistory.length > lfhfSmoothingWindow) lfhfHistory.shift();
                const valid = lfhfHistory.filter(v => v != null && !Number.isNaN(v));
                if (valid.length > 0) {
                    row.lfhfSmoothed = valid.reduce((a, b) => a + b, 0) / valid.length;
                }
            }
        }
        updated.push(row);
    }
    recordedData = updated;
}

function cleanRrSeries(series) {
    if (!series || series.length === 0) return { cleaned: [], rawCount: 0, rejectedPct: 0 };
    const cleaned = [];
    let prev = null;
    let rawCount = 0;
    let rejected = 0;
    for (let rr of series) {
        if (rr == null || Number.isNaN(rr)) {
            rejected++;
            continue;
        }
        rawCount++;
        if (prev !== null) {
            const delta = Math.abs(rr - prev);
            const rel = delta / Math.max(prev, 1);
            if (delta > outlierAbsMs || rel > outlierRel) {
                rejected++;
                continue;
            }
        }
        cleaned.push(rr);
        prev = rr;
    }
    const rejectedPct = rawCount > 0 ? ((rejected / rawCount) * 100) : 0;
    return { cleaned, rawCount, rejectedPct };
}

function cubicSplineCoefficients(x, y) {
    const n = x.length;
    const a = y.slice();
    const b = new Array(n - 1);
    const d = new Array(n - 1);
    const h = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) h[i] = x[i + 1] - x[i];
    const alpha = new Array(n - 1);
    for (let i = 1; i < n - 1; i++) {
        alpha[i] = (3 / h[i]) * (a[i + 1] - a[i]) - (3 / h[i - 1]) * (a[i] - a[i - 1]);
    }
    const c = new Array(n).fill(0);
    const l = new Array(n).fill(0);
    const mu = new Array(n).fill(0);
    const z = new Array(n).fill(0);
    l[0] = 1;
    mu[0] = 0;
    z[0] = 0;
    for (let i = 1; i < n - 1; i++) {
        l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
        mu[i] = h[i] / l[i];
        z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }
    l[n - 1] = 1;
    z[n - 1] = 0;
    c[n - 1] = 0;
    for (let j = n - 2; j >= 0; j--) {
        c[j] = z[j] - mu[j] * c[j + 1];
        b[j] = (a[j + 1] - a[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
        d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
    }
    return { a, b, c, d, x };
}

function cubicSplineEval(coef, xq) {
    const { a, b, c, d, x } = coef;
    let i = 0;
    let j = x.length - 2;
    while (j - i > 1) {
        const m = Math.floor((i + j) / 2);
        if (x[m] > xq) {
            j = m;
        } else {
            i = m;
        }
    }
    const dx = xq - x[i];
    return a[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
}

function welchPsd(series, fs) {
    const N = series.length;
    if (N < 32) return null;
    const segLen = Math.max(32, Math.min(256, nextPow2(Math.floor(N / 2))));
    const step = Math.floor(segLen / 2);
    if (segLen > N) return null;
    const window = new Array(segLen);
    for (let i = 0; i < segLen; i++) {
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (segLen - 1)));
    }
    const scale = window.reduce((acc, v) => acc + v * v, 0);
    const accum = new Array(segLen / 2).fill(0);
    let segments = 0;
    for (let start = 0; start + segLen <= N; start += step) {
        const re = new Array(segLen).fill(0);
        const im = new Array(segLen).fill(0);
        let mean = 0;
        for (let i = 0; i < segLen; i++) mean += series[start + i];
        mean /= segLen;
        for (let i = 0; i < segLen; i++) {
            re[i] = (series[start + i] - mean) * window[i];
        }
        fft(re, im);
        for (let k = 1; k < segLen / 2; k++) {
            const power = (re[k] * re[k] + im[k] * im[k]) / (scale * fs);
            accum[k] += power;
        }
        segments++;
    }
    if (segments === 0) return null;
    const freqs = [];
    const powers = [];
    for (let k = 1; k < segLen / 2; k++) {
        freqs.push((k * fs) / segLen);
        powers.push(accum[k] / segments);
    }
    return { freqs, powers };
}

function updateElapsedTime() {
    if (!connectionStartTime) {
        elapsedTimeEl.textContent = '00:00:00';
        return;
    }
    const now = new Date();
    const diffMs = now - connectionStartTime;
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hh = pad2(hours);
    const mm = pad2(minutes);
    const ss = pad2(seconds);
    elapsedTimeEl.textContent = `${hh}:${mm}:${ss}`;
}

function resetHrvMetrics() {
    rrSeries = [];
    rmssdValueEl.textContent = '--';
    sdnnValueEl.textContent = '--';
    nn50ValueEl.textContent = '--';
    pnn50ValueEl.textContent = '--';
    lfhfValueEl.textContent = '--';
    lfhfRawValueEl.textContent = '--';
    lfPowerValueEl.textContent = '--';
    hfPowerValueEl.textContent = '--';
    windowQualityValueEl.textContent = '--';
    hrvIndexValueEl.textContent = '--';
    lfhfHistory = [];
}

function computeHrvMetricsFromSeries(series) {
    const n = series.length;
    if (n < 2) return null;

    const cleanedRes = cleanRrSeries(series);
    const cleaned = cleanedRes.cleaned;
    if (cleaned.length < 2) return null;

    let sum = 0;
    for (let v of cleaned) sum += v;
    const mean = sum / cleaned.length;

    let varAcc = 0;
    for (let v of cleaned) {
        const diff = v - mean;
        varAcc += diff * diff;
    }
    const sdnn = Math.sqrt(varAcc / (cleaned.length - 1));

    let sumSqDiff = 0;
    let nn50 = 0;
    for (let i = 0; i < cleaned.length - 1; i++) {
        const d = cleaned[i + 1] - cleaned[i];
        const ad = Math.abs(d);
        sumSqDiff += d * d;
        if (ad > 50) nn50++;
    }
    const rmssd = Math.sqrt(sumSqDiff / (cleaned.length - 1));
    const pnn50 = (nn50 / (cleaned.length - 1)) * 100;

    const hrvIndex = (rmssd + sdnn) / 2;

    // Calcolo spettro LF/HF reale a partire dalla serie RR
    const spectrum = computeSpectrumFromSeries(cleaned);
    const lfhf = spectrum ? spectrum.lfhf : null;

    return { rmssd, sdnn, nn50, pnn50, hrvIndex, lfhf, spectrum, rejectedPct: cleanedRes.rejectedPct, windowSamples: cleaned.length };
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

function computeSpectrumFromSeries(series) {
    // Restituisce spettro (Hz -> potenza) e ratio LF/HF con Welch + spline
    const cleanedRes = cleanRrSeries(series);
    const cleaned = cleanedRes.cleaned;
    const n = cleaned.length;
    if (n < 16) return null;

    const t = new Array(n);
    t[0] = 0;
    for (let i = 1; i < n; i++) {
        t[i] = t[i - 1] + cleaned[i - 1] / 1000;
    }
    const totalTime = t[n - 1];
    const fs = resampleHz; // Hz, frequenza di campionamento
    const N = Math.floor(totalTime * fs);
    if (N < 32) return null;

    const spline = cubicSplineCoefficients(t, cleaned);
    const rrInterp = new Array(N);
    for (let k = 0; k < N; k++) {
        const tg = k / fs;
        const val = cubicSplineEval(spline, tg);
        rrInterp[k] = val;
    }

    const psd = welchPsd(rrInterp, fs);
    if (!psd) return null;

    let lfPower = 0;
    let hfPower = 0;
    for (let i = 0; i < psd.freqs.length; i++) {
        const f = psd.freqs[i];
        const p = psd.powers[i];
        if (f >= 0.04 && f < 0.15) {
            lfPower += p;
        } else if (f >= 0.15 && f <= 0.4) {
            hfPower += p;
        }
    }

    const lfhf = (hfPower > 0 && lfPower > 0) ? (lfPower / hfPower) : null;
    return { freqs: psd.freqs, powers: psd.powers, lfPower, hfPower, lfhf };
}

function updateHrvMetrics() {
    const windowed = getWindowedRrSeries(lfhfWindowSeconds);
    const metrics = computeHrvMetricsFromSeries(windowed);
    if (!metrics) {
        resetHrvMetrics();
        return;
    }

    rmssdValueEl.textContent = metrics.rmssd.toFixed(0);
    sdnnValueEl.textContent = metrics.sdnn.toFixed(0);
    nn50ValueEl.textContent = metrics.nn50.toString();
    pnn50ValueEl.textContent = metrics.pnn50.toFixed(1);

    // Analisi spettrale LF/HF reale
    let lfhfSmoothed = null;
    if (metrics.lfhf != null && !Number.isNaN(metrics.lfhf)) {
        lfhfHistory.push(metrics.lfhf);
        if (lfhfHistory.length > lfhfSmoothingWindow) lfhfHistory.shift();
        const valid = lfhfHistory.filter(v => v != null && !Number.isNaN(v));
        if (valid.length > 0) {
            lfhfSmoothed = valid.reduce((a, b) => a + b, 0) / valid.length;
        }
    }
    lfhfValueEl.textContent = (lfhfSmoothed != null && !Number.isNaN(lfhfSmoothed)) ? lfhfSmoothed.toFixed(2) : '--';
    lfhfRawValueEl.textContent = (metrics.lfhf != null && !Number.isNaN(metrics.lfhf)) ? metrics.lfhf.toFixed(2) : '--';

    if (metrics.spectrum && metrics.spectrum.lfPower != null && metrics.spectrum.hfPower != null) {
        lfPowerValueEl.textContent = metrics.spectrum.lfPower.toExponential(3);
        hfPowerValueEl.textContent = metrics.spectrum.hfPower.toExponential(3);
    } else {
        lfPowerValueEl.textContent = '--';
        hfPowerValueEl.textContent = '--';
    }

    const validPct = metrics.rejectedPct != null ? (100 - metrics.rejectedPct) : null;
    if (validPct != null && !Number.isNaN(validPct)) {
        windowQualityValueEl.textContent = `${validPct.toFixed(1)}% RR validi`;
    } else {
        windowQualityValueEl.textContent = '--';
    }

    hrvIndexValueEl.textContent = metrics.hrvIndex.toFixed(0);
}

// --- IMPOSTAZIONE GRAFICO CHART.JS ---
const ctx = document.getElementById('heartRateChart').getContext('2d');

const heartRateChart = new Chart(ctx, {
    type: 'line', 
    data: {
        labels: [], 
        datasets: [{
            label: 'Intervallo R-R (ms)', 
            data: [], 
            borderColor: '#0a84ff',
            backgroundColor: 'rgba(10, 132, 255, 0.16)',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                display: true,
                ticks: { 
                    color: 'rgba(60, 60, 67, 0.7)',
                    font: { family: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' },
                    maxTicksLimit: 6,
                    autoSkip: true
                },
                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                title: {
                    display: true,
                    text: 'Tempo (HH:MM:SS)',
                    color: 'rgba(60, 60, 67, 0.7)'
                }
            },
            y: {
                display: true,
                min: 500,
                max: 1500,
                ticks: { 
                    color: 'rgba(60, 60, 67, 0.7)',
                    font: { family: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }
                },
                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                title: {
                    display: true,
                    text: 'Intervallo R-R (ms)',
                    color: 'rgba(60, 60, 67, 0.7)'
                }
            }
        },
        plugins: {
            legend: { display: false }
        },
        animation: false 
    }
});
updateChartStyleForMetric();

// --- LOGICA BLUETOOTH ---

modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        setMode(mode);
    });
});

connectButton.addEventListener('click', () => {
    if (currentMode !== 'live') return;
    if (isConnected) {
        const confirmed = window.confirm('Vuoi disconnettere il sensore? I dati rimarranno visibili ma non saranno più in tempo reale.');
        if (!confirmed) return;
        disconnectDevice();
    } else {
        connectToDevice();
    }
});
function setMode(mode) {
    if (mode === currentMode) return;

    // conferma quando si cambia modalità (LIVE <-> DEBUG)
    if (currentMode === 'live' && mode === 'debug') {
        const confirmed = window.confirm('Passare alla modalità debug? Tutti i dati live attualmente registrati verranno cancellati.');
        if (!confirmed) return;
    } else if (currentMode === 'debug' && mode === 'live') {
        const confirmed = window.confirm('Passare alla modalità live? Tutti i dati caricati da CSV verranno cancellati.');
        if (!confirmed) return;
    }

    currentMode = mode;

    modeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'live') {
        // Torna alla modalità live (BLE)
        if (elapsedLabelEl) elapsedLabelEl.textContent = 'Tempo trascorso';

        loadCsvButton.style.display = 'none';
        connectButton.style.display = 'block';
        // riattiva il pulsante +
        if (moreButton) {
            moreButton.style.display = 'flex';
            exportMenu.classList.remove('open');
            moreButton.setAttribute('aria-expanded', 'false');
        }

        statoEl.textContent = isConnected ? 'Connesso' : 'Non connesso';
        connectionTimeEl.textContent = isConnected && connectionStartTime
            ? 'Dal: ' + formatLocalTimestamp(connectionStartTime)
            : '';
        if (!isConnected) {
            connectionStartTime = null;
            elapsedTimeEl.textContent = '00:00:00';
        }
        updateLiveIndicator(isConnected);
        clearMeasurementData();
    } else {
        // Passa alla modalità debug (CSV)
        if (elapsedLabelEl) elapsedLabelEl.textContent = 'Durata totale';

        if (isConnected) {
            disconnectDevice();
        }
        connectButton.style.display = 'none';
        loadCsvButton.style.display = 'block';

        // nascondi il pulsante + e chiudi il menu esportazione
        if (moreButton) {
            moreButton.style.display = 'none';
            exportMenu.classList.remove('open');
            moreButton.setAttribute('aria-expanded', 'false');
        }

        statoEl.textContent = 'Modalità debug';
        connectionTimeEl.textContent = '';
        connectionStartTime = null;
        if (connectionTimerId) {
            clearInterval(connectionTimerId);
            connectionTimerId = null;
        }
        elapsedTimeEl.textContent = '00:00:00';
        updateLiveIndicator(false);
        clearMeasurementData();
    }
    updateParamControlsVisibility();
}
loadCsvButton.addEventListener('click', () => {
    if (currentMode !== 'debug') return;
    csvInput.click();
});

csvInput.addEventListener('change', (e) => {
    if (currentMode !== 'debug') return;
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        loadCsvDataFromText(ev.target.result);
    };
    reader.readAsText(file);
});

function loadCsvDataFromText(text) {
    clearMeasurementData();
    recordedData = [];
    rrSeries = [];
    maxBpm = null;
    maxBpmTimestamp = null;
    minBpm = null;
    minBpmTimestamp = null;

    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
        alert('Il file CSV non contiene dati sufficienti.');
        return;
    }

    const header = lines[0].split(',');
    const idxTimestamp = header.indexOf('timestamp');
    const idxBpm = header.indexOf('bpm');
    const idxRr = header.indexOf('rr_ms');
    const idxRmssd = header.indexOf('rmssd_ms');
    const idxSdnn = header.indexOf('sdnn_ms');
    const idxPnn50 = header.indexOf('pnn50_percent');
    const idxHrv = header.indexOf('hrv_index_ms');

    if (idxTimestamp === -1) {
        alert('CSV non valido: manca la colonna "timestamp".');
        return;
    }

    let lastBpm = null;
    let lastRr = null;
    let firstTimestampStr = null;
    let lastTimestampStr = null;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');

        const ts = cols[idxTimestamp] || '';
        if (ts) {
            if (!firstTimestampStr) firstTimestampStr = ts;
            lastTimestampStr = ts;
        }
        const bpm = (idxBpm !== -1 && cols[idxBpm] !== '') ? Number(cols[idxBpm]) : null;
        const rr = (idxRr !== -1 && cols[idxRr] !== '') ? Number(cols[idxRr]) : null;
        const rmssd = (idxRmssd !== -1 && cols[idxRmssd] !== '') ? Number(cols[idxRmssd]) : null;
        const sdnn = (idxSdnn !== -1 && cols[idxSdnn] !== '') ? Number(cols[idxSdnn]) : null;
        const pnn50 = (idxPnn50 !== -1 && cols[idxPnn50] !== '') ? Number(cols[idxPnn50]) : null;
        const hrvIndex = (idxHrv !== -1 && cols[idxHrv] !== '') ? Number(cols[idxHrv]) : null;

        recordedData.push({
            timestamp: ts,
            bpm: bpm,
            rr_ms: rr,
            rmssd: rmssd,
            sdnn: sdnn,
            pnn50: pnn50,
            hrvIndex: hrvIndex,
            lfhf: null,
            lfhfSmoothed: null,
            lfPower: null,
            hfPower: null,
            windowQualityPct: null
        });

        if (rr != null && !Number.isNaN(rr)) {
            rrSeries.push(rr);
            lastRr = rr;
        }
        if (bpm != null && !Number.isNaN(bpm)) {
            lastBpm = bpm;
            if (maxBpm === null || bpm > maxBpm) {
                maxBpm = bpm;
                maxBpmTimestamp = ts;
            }
            if (minBpm === null || bpm < minBpm) {
                minBpm = bpm;
                minBpmTimestamp = ts;
            }
        }
    }

    if (lastBpm != null) bpmValueEl.textContent = lastBpm;
    if (lastRr != null) rrValueEl.textContent = lastRr;

    if (maxBpm != null) {
        maxBpmValueEl.textContent = maxBpm;
        maxBpmTimeEl.textContent = maxBpmTimestamp;
    }
    if (minBpm != null) {
        minBpmValueEl.textContent = minBpm;
        minBpmTimeEl.textContent = minBpmTimestamp;
    }

    recomputeMetricsForRecordedData();
    updateHrvMetrics();
    redrawChartForMetric();

    // durata totale basata sugli estremi temporali del CSV
    if (firstTimestampStr && lastTimestampStr) {
        const startDate = parseTimestampString(firstTimestampStr);
        const endDate = parseTimestampString(lastTimestampStr);
        if (startDate && endDate && endDate >= startDate) {
            const diffMs = endDate - startDate;
            const totalSeconds = Math.floor(diffMs / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const hh = pad2(hours);
            const mm = pad2(minutes);
            const ss = pad2(seconds);
            elapsedTimeEl.textContent = `${hh}:${mm}:${ss}`;
        } else {
            elapsedTimeEl.textContent = '00:00:00';
        }
    } else {
        elapsedTimeEl.textContent = '00:00:00';
    }

    connectionTimeEl.textContent = 'Da file CSV';
    updateLiveIndicator(false);
}

async function connectToDevice() {
    try {
        statoEl.textContent = 'Ricerca dispositivo...';
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [HR_SERVICE_UUID] }]
        });

        statoEl.textContent = 'Connessione al GATT server...';
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(HR_SERVICE_UUID);
        const characteristic = await service.getCharacteristic(HR_MEASUREMENT_CHAR_UUID);

        await characteristic.startNotifications();
        statoEl.textContent = 'Connesso';
        statusLed.classList.add('connected');
        isConnected = true;
        connectedDevice = device;
        connectButton.textContent = 'Disconnetti';
        connectButton.classList.add('disconnect');
        updateLiveIndicator(true);
        clearMeasurementData();

        connectionStartTime = new Date();
        connectionTimeEl.textContent = 'Dal: ' + formatLocalTimestamp(connectionStartTime);
        updateElapsedTime();
        if (connectionTimerId) {
            clearInterval(connectionTimerId);
        }
        connectionTimerId = setInterval(updateElapsedTime, 1000);

        characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
        device.addEventListener('gattserverdisconnected', onDisconnected);

    } catch (error) {
        statoEl.textContent = `Errore: ${error.message}`;
        isConnected = false;
        connectedDevice = null;
        connectButton.textContent = 'Connetti';
        connectButton.classList.remove('disconnect');
        connectButton.style.display = 'block';
        updateLiveIndicator(false);
    }
}

function disconnectDevice() {
    try {
        if (connectedDevice && connectedDevice.gatt.connected) {
            connectedDevice.gatt.disconnect();
        } else {
            onDisconnected();
        }
    } catch (e) {
        console.error(e);
        onDisconnected();
    }
}

function onDisconnected() {
    isConnected = false;
    connectedDevice = null;
    connectButton.textContent = 'Connetti';
    connectButton.classList.remove('disconnect');
    connectButton.style.display = 'block';

    statoEl.textContent = 'Disconnesso – dati non più in tempo reale (alla prossima connessione i dati verranno azzerati)';
    statusLed.classList.remove('connected');

    if (connectionTimerId) {
        clearInterval(connectionTimerId);
        connectionTimerId = null;
    }
    connectionStartTime = null;

    // Non cancelliamo i valori mostrati nei tab o nel grafico:
    // manteniamo bpm, intervallo R-R, BPM max/min, HRV, serie RR e dati registrati.

    isPaused = false;
    pauseButton.textContent = '⏸';

    updateLiveIndicator(false);
}

function handleCharacteristicValueChanged(event) {
    const value = event.target.value;
    const heartRateData = parseHeartRate(value); 

    if (heartRateData) {
        bpmValueEl.textContent = heartRateData.bpm;
        const now = new Date();
        const localTimestampStr = formatLocalTimestamp(now);

        // BPM max/min con timestamp nel formato CSV
        if (maxBpm === null || heartRateData.bpm > maxBpm) {
            maxBpm = heartRateData.bpm;
            maxBpmTimestamp = localTimestampStr;
            maxBpmValueEl.textContent = maxBpm;
            maxBpmTimeEl.textContent = maxBpmTimestamp;
        }
        if (minBpm === null || heartRateData.bpm < minBpm) {
            minBpm = heartRateData.bpm;
            minBpmTimestamp = localTimestampStr;
            minBpmValueEl.textContent = minBpm;
            minBpmTimeEl.textContent = minBpmTimestamp;
        }

        if (heartRateData.rrIntervals.length > 0) {
            let chartUpdated = false;
            heartRateData.rrIntervals.forEach(rr_ms => {
                const timestamp = localTimestampStr;

                rrValueEl.textContent = rr_ms;

                // aggiorna serie RR per HRV
                rrSeries.push(rr_ms);
                if (rrSeries.length > rrMaxBuffer) {
                    rrSeries.shift();
                }

                const dataPoint = {
                    timestamp: timestamp,
                    bpm: heartRateData.bpm,
                    rr_ms: rr_ms,
                    rmssd: null,
                    sdnn: null,
                    pnn50: null,
                    hrvIndex: null,
                    lfhf: null,
                    lfhfSmoothed: null,
                    lfPower: null,
                    hfPower: null,
                    windowQualityPct: null
                };
                recordedData.push(dataPoint);

                const windowMetrics = computeHrvMetricsFromSeries(getWindowedRrSeries(lfhfWindowSeconds));
                if (windowMetrics) {
                    dataPoint.rmssd = windowMetrics.rmssd;
                    dataPoint.sdnn = windowMetrics.sdnn;
                    dataPoint.pnn50 = windowMetrics.pnn50;
                    dataPoint.hrvIndex = windowMetrics.hrvIndex;
                    dataPoint.lfhf = windowMetrics.lfhf;
                    dataPoint.lfPower = windowMetrics.spectrum ? windowMetrics.spectrum.lfPower : null;
                    dataPoint.hfPower = windowMetrics.spectrum ? windowMetrics.spectrum.hfPower : null;
                    dataPoint.windowQualityPct = windowMetrics.rejectedPct != null ? (100 - windowMetrics.rejectedPct) : null;
                    if (lfhfHistory.length > 0) {
                        const valid = lfhfHistory.filter(v => v != null && !Number.isNaN(v));
                        if (valid.length > 0) {
                            dataPoint.lfhfSmoothed = valid.reduce((a, b) => a + b, 0) / valid.length;
                        }
                    }
                }

                let valueForChart = null;
                switch (currentMetric) {
                    case 'rr':
                        valueForChart = rr_ms;
                        break;
                    case 'bpm':
                        valueForChart = heartRateData.bpm;
                        break;
                    case 'rmssd':
                        valueForChart = rmssd;
                        break;
                    case 'sdnn':
                        valueForChart = sdnn;
                        break;
                    case 'pnn50':
                        valueForChart = pnn50;
                        break;
                    case 'hrvIndex':
                        valueForChart = hrvIndex;
                        break;
                }

                if (!isPaused && valueForChart != null && !Number.isNaN(valueForChart)) {
                    heartRateChart.data.labels.push(extractTimeLabel(timestamp));
                    heartRateChart.data.datasets[0].data.push(valueForChart);

                    if (heartRateChart.data.labels.length > MAX_DATA_POINTS) {
                        heartRateChart.data.labels.shift();
                        heartRateChart.data.datasets[0].data.shift();
                    }

                    chartUpdated = true;
                }
            });

            updateHrvMetrics();

            if (chartUpdated) {
                heartRateChart.update('none');
            } else if (currentMetric === 'spectrum' && !isPaused) {
                redrawChartForMetric();
            }
        }
    }
}

function parseHeartRate(value) {
    const flags = value.getUint8(0);
    let offset = 1;
    let bpm;
    const rate16Bits = (flags & 0x1) !== 0;
    if (rate16Bits) {
        bpm = value.getUint16(offset, true);
        offset += 2;
    } else {
        bpm = value.getUint8(offset);
        offset += 1;
    }
    const rrIntervalPresent = (flags & 0x10) !== 0;
    const rrIntervals = [];
    if (rrIntervalPresent) {
        while (offset < value.byteLength) {
            let rr_raw = value.getUint16(offset, true);
            let rr_ms = Math.round((rr_raw / 1024) * 1000);
            rrIntervals.push(rr_ms);
            offset += 2;
        }
    }
    return { bpm: bpm, rrIntervals: rrIntervals };
}

function exportCSV(mode) {
    exportMenu.classList.remove('open');
    moreButton.setAttribute('aria-expanded', 'false');

    if (recordedData.length === 0) {
        alert('Nessun dato da esportare');
        return;
    }

    let header = '';
    let rows = '';

    if (mode === 'current') {
        if (currentMetric === 'rr') {
            header = 'timestamp,rr_ms\n';
            rows = recordedData.map(d => `${d.timestamp},${d.rr_ms ?? ''}`).join('\n');
        } else if (currentMetric === 'bpm') {
            header = 'timestamp,bpm\n';
            rows = recordedData.map(d => `${d.timestamp},${d.bpm ?? ''}`).join('\n');
        } else if (currentMetric === 'rmssd') {
            header = 'timestamp,rmssd_ms\n';
            rows = recordedData.map(d => `${d.timestamp},${(d.rmssd != null && !Number.isNaN(d.rmssd)) ? d.rmssd.toFixed(2) : ''}`).join('\n');
        } else if (currentMetric === 'sdnn') {
            header = 'timestamp,sdnn_ms\n';
            rows = recordedData.map(d => `${d.timestamp},${(d.sdnn != null && !Number.isNaN(d.sdnn)) ? d.sdnn.toFixed(2) : ''}`).join('\n');
        } else if (currentMetric === 'pnn50') {
            header = 'timestamp,pnn50_percent\n';
            rows = recordedData.map(d => `${d.timestamp},${(d.pnn50 != null && !Number.isNaN(d.pnn50)) ? d.pnn50.toFixed(2) : ''}`).join('\n');
        } else if (currentMetric === 'hrvIndex') {
            header = 'timestamp,hrv_index_ms\n';
            rows = recordedData.map(d => `${d.timestamp},${(d.hrvIndex != null && !Number.isNaN(d.hrvIndex)) ? d.hrvIndex.toFixed(2) : ''}`).join('\n');
        } else if (currentMetric === 'spectrum') {
            const windowed = getWindowedRrSeries(lfhfWindowSeconds);
            const spec = computeSpectrumFromSeries(windowed);
            if (!spec || !spec.freqs || !spec.freqs.length) {
                alert('Nessun dato di spettro disponibile per questa finestra.');
                return;
            }
            header = 'freq_hz,power\n';
            rows = spec.freqs.map((f, idx) => `${f.toFixed(4)},${spec.powers[idx].toExponential(6)}`).join('\n');
        }
    } else {
        header = 'timestamp,bpm,rr_ms,rmssd_ms,sdnn_ms,pnn50_percent,hrv_index_ms,lfhf_ratio,lfhf_smoothed,lf_power,hf_power,window_quality_pct,config_outlier_abs_ms,config_outlier_rel,config_resample_hz,config_window_s\n';
        rows = recordedData.map(d => {
            const bpm = d.bpm ?? '';
            const rr = d.rr_ms ?? '';
            const rmssdStr = (d.rmssd != null && !Number.isNaN(d.rmssd)) ? d.rmssd.toFixed(2) : '';
            const sdnnStr = (d.sdnn != null && !Number.isNaN(d.sdnn)) ? d.sdnn.toFixed(2) : '';
            const pnn50Str = (d.pnn50 != null && !Number.isNaN(d.pnn50)) ? d.pnn50.toFixed(2) : '';
            const hrvStr = (d.hrvIndex != null && !Number.isNaN(d.hrvIndex)) ? d.hrvIndex.toFixed(2) : '';
            const lfhfStr = (d.lfhf != null && !Number.isNaN(d.lfhf)) ? d.lfhf.toFixed(3) : '';
            const lfhfSmoothStr = (d.lfhfSmoothed != null && !Number.isNaN(d.lfhfSmoothed)) ? d.lfhfSmoothed.toFixed(3) : '';
            const lfStr = (d.lfPower != null && !Number.isNaN(d.lfPower)) ? d.lfPower.toExponential(6) : '';
            const hfStr = (d.hfPower != null && !Number.isNaN(d.hfPower)) ? d.hfPower.toExponential(6) : '';
            const qualityStr = (d.windowQualityPct != null && !Number.isNaN(d.windowQualityPct)) ? d.windowQualityPct.toFixed(2) : '';
            return `${d.timestamp},${bpm},${rr},${rmssdStr},${sdnnStr},${pnn50Str},${hrvStr},${lfhfStr},${lfhfSmoothStr},${lfStr},${hfStr},${qualityStr},${outlierAbsMs},${outlierRel},${resampleHz},${lfhfWindowSeconds}`;
        }).join('\n');
    }

    const csvContent = header + rows;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = (mode === 'current') ? `_${currentMetric}` : '_all';

    a.href = url;
    a.download = `hrv_data${suffix}_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function redrawChartForMetric() {
    heartRateChart.data.labels = [];
    heartRateChart.data.datasets[0].data = [];

    if (currentMetric === 'spectrum') {
        heartRateChart.config.type = 'bar';
        const windowed = getWindowedRrSeries(lfhfWindowSeconds);
        const spec = computeSpectrumFromSeries(windowed);
        if (spec && spec.freqs && spec.freqs.length) {
            heartRateChart.data.labels = spec.freqs.map(f => f.toFixed(2));
            heartRateChart.data.datasets[0].data = spec.powers;
        }

        heartRateChart.options.scales.x.title.text = 'Frequenza (Hz)';
        heartRateChart.options.scales.y.title.text = 'Potenza (a.u.)';
        heartRateChart.options.scales.y.min = 0;
        heartRateChart.options.scales.y.max = undefined;
        heartRateChart.data.datasets[0].label = 'Spettro RR';
        updateChartStyleForMetric();
        heartRateChart.update();
        return;
    }

    heartRateChart.config.type = 'line';

    recordedData.forEach(d => {
        let value = null;
        switch (currentMetric) {
            case 'rr':
                value = d.rr_ms;
                break;
            case 'bpm':
                value = d.bpm;
                break;
            case 'rmssd':
                value = d.rmssd;
                break;
            case 'sdnn':
                value = d.sdnn;
                break;
            case 'pnn50':
                value = d.pnn50;
                break;
            case 'hrvIndex':
                value = d.hrvIndex;
                break;
        }
        if (value != null && !Number.isNaN(value)) {
            heartRateChart.data.labels.push(extractTimeLabel(d.timestamp));
            heartRateChart.data.datasets[0].data.push(value);
        }
    });

    heartRateChart.options.scales.x.title.text = 'Tempo (HH:MM:SS)';

    let yMin = 0;
    let yMax = 1;
    let yLabel = '';

    switch (currentMetric) {
        case 'rr':
            yMin = 500;
            yMax = 1500;
            yLabel = 'Intervallo R-R (ms)';
            break;
        case 'bpm':
            yMin = 40;
            yMax = 180;
            yLabel = 'Battito (BPM)';
            break;
        case 'rmssd':
            yMin = 0;
            yMax = 200;
            yLabel = 'RMSSD (ms)';
            break;
        case 'sdnn':
            yMin = 0;
            yMax = 200;
            yLabel = 'SDNN (ms)';
            break;
        case 'pnn50':
            yMin = 0;
            yMax = 100;
            yLabel = 'pNN50 (%)';
            break;
        case 'hrvIndex':
            yMin = 0;
            yMax = 200;
            yLabel = 'HRV (indice, ms)';
            break;
    }

    heartRateChart.options.scales.y.min = yMin;
    heartRateChart.options.scales.y.max = yMax;
    heartRateChart.options.scales.y.title.text = yLabel;
    heartRateChart.data.datasets[0].label = yLabel;

    updateChartStyleForMetric();
    heartRateChart.update();
}

