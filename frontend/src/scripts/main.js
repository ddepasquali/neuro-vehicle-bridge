import { pad2, formatLocalTimestamp, formatFileTimestamp, parseTimestampString, extractTimeLabel } from '../lib/time.js';
import { createZipBlob } from '../lib/zip.js';
import { initObdModule } from '../modules/obd/index.js';
import { initPhyphoxModule } from '../modules/phyphox/index.js';
import { initOsmo360Module } from '../modules/osmo360/index.js';
import '../modules/muse/index.js';

// Riferimenti agli elementi HTML (Polar/HRV + UI comuni)
const connectButton = document.getElementById('connectButton');
const loadCsvButton = document.getElementById('loadCsvButton');
const csvInput = document.getElementById('csvInput');
const modeButtons = document.querySelectorAll('.mode-btn');
const metricSelect = document.getElementById('metricSelect');
const windowSelect = document.getElementById('windowSelect');
const paramControls = document.getElementById('paramControls');
const outlierAbsSelect = document.getElementById('outlierAbsSelect');
const outlierRelSelect = document.getElementById('outlierRelSelect');
const resampleSelect = document.getElementById('resampleSelect');
const downloadButton = document.getElementById('downloadButton');
const settingsButton = document.getElementById('settingsButton');
const settingsMenu = document.getElementById('settingsMenu');
const markerButton = document.getElementById('markerButton');
const statusLed = document.getElementById('statusLed');
const statoEl = document.getElementById('stato');
const polarBatteryBadge = document.getElementById('polarBatteryBadge');
const processingIndicator = document.getElementById('processingIndicator');
const chartDropZone = document.getElementById('chartDropZone');
const chartScroll = document.getElementById('chartScroll');
const chartScrollInput = document.getElementById('chartScrollInput');
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
const scienceCardEl = document.getElementById('scienceCard');
const lfhfToggle = document.getElementById('lfhfToggle');
const lfhfPanel = document.getElementById('lfhfPanel');
const museBandsToggle = document.getElementById('museBandsToggle');
const museBandsPanel = document.getElementById('museBandsPanel');
const obdMoreToggle = document.getElementById('obdMoreToggle');
const obdMorePanel = document.getElementById('obdMorePanel');
const phyphoxMoreToggle = document.getElementById('phyphoxMoreToggle');
const phyphoxMorePanel = document.getElementById('phyphoxMorePanel');

function updateLiveIndicator() {
    // Indicator removed from UI; keep no-op for legacy calls.
}

function updatePolarBattery(level) {
    if (polarBatteryBadge) {
        polarBatteryBadge.textContent = (level != null && !Number.isNaN(level)) ? `${level}%` : '--%';
    }
}

// UUID Servizi BLE
const HR_SERVICE_UUID = 'heart_rate';
const HR_MEASUREMENT_CHAR_UUID = 'heart_rate_measurement';
const BATTERY_SERVICE_UUID = 'battery_service';
const BATTERY_LEVEL_CHAR_UUID = 'battery_level';
const POLAR_REDRAW_MS = 500; // throttling per allineare lo scorrimento ai grafici Muse
// Battery read interval; shorten to 1s for more frequent updates
const BATTERY_POLL_MS = 1000;
const MARKER_COOLDOWN_MS = 15000;
const POLAR_WORKER_TIMEOUT_MS = 8000;

// Numero massimo di punti visibili: finestra scorrevole rapida
const CHART_WINDOW_POINTS = 30;
const BATTERY_WINDOW_POINTS = 100;

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
let currentMetric = 'bpm'; // 'rr', 'bpm', 'nn50', 'rmssd', 'sdnn', 'pnn50', 'hrvIndex', 'spectrum'
let currentMode = 'live'; // 'live' per BLE, 'debug' per CSV
let lfhfWindowSeconds = 120; // finestra per spettro LF/HF
const rrMaxBuffer = 300;
let outlierAbsMs = 200;
let outlierRel = 0.2;
let resampleHz = 4;
const lfhfSmoothingWindow = 3;
let lfhfHistory = [];
let batteryPollTimer = null;
let batteryCharacteristic = null;
let lastPolarRedrawTs = 0;
let batteryStartLabel = null;
let markerCounter = 1;
let markerCooldownTimer = null;
let markerActive = true;
let chartControlsEnabled = false;
let debugWindowStart = 0;
let chartWindowStartIdx = 0;
let isCsvLoading = false;
let isProcessing = false;
let polarWorker = null;
let polarWorkerRequestId = 0;
let polarWorkerLatest = 0;
const polarWorkerPending = new Map();
let polarSessionCounter = 1;

function updateChartStyleForMetric() {
    let borderColor = '#0a84ff';
    let backgroundColor = 'rgba(10, 132, 255, 0.16)';
    let tension = 0.1;
    let pointRadius = 1;
    let borderWidth = 2;

    switch (currentMetric) {
        case 'rr':
            borderColor = '#0a84ff'; // blu come Intervallo R-R
            backgroundColor = 'rgba(10, 132, 255, 0.16)';
            break;
        case 'bpm':
            borderColor = '#ff3b30'; // rosso come cuore
            backgroundColor = 'rgba(255, 59, 48, 0.16)';
            pointRadius = 2.5; // punti ben visibili come nello stile originale
            borderWidth = 2.5;
            break;
        case 'rmssd':
            borderColor = '#34c759'; // verde brillante
            backgroundColor = 'rgba(52, 199, 89, 0.16)';
            break;
        case 'sdnn':
            borderColor = '#ff9f0a'; // arancio
            backgroundColor = 'rgba(255, 159, 10, 0.18)';
            break;
        case 'pnn50':
            borderColor = '#007aff'; // blu iOS
            backgroundColor = 'rgba(0, 122, 255, 0.16)';
            break;
        case 'hrvIndex':
            borderColor = '#8e44ad'; // viola
            backgroundColor = 'rgba(142, 68, 173, 0.18)';
            break;
        case 'spectrum':
            borderColor = '#5856d6'; // indaco
            backgroundColor = 'rgba(88, 86, 214, 0.18)';
            break;
        case 'battery':
            borderColor = '#ffcc00'; // giallo
            backgroundColor = 'rgba(255, 204, 0, 0.18)';
            break;
    }

    heartRateChart.data.datasets[0].borderColor = borderColor;
    heartRateChart.data.datasets[0].backgroundColor = backgroundColor;
    heartRateChart.data.datasets[0].tension = tension;
    heartRateChart.data.datasets[0].pointRadius = pointRadius;
    heartRateChart.data.datasets[0].borderWidth = borderWidth;
}

function clearMeasurementData() {
    recordedData = [];
    rrSeries = [];
    markerCounter = 1;
    resetHrvMetrics();
    updatePolarBattery(null);
    batteryStartLabel = null;

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

    seedChartWindow();
    heartRateChart.update();
    setChartControlsEnabled(false);
    updateChartScrollState();
    // in debug, nascondi anche il picker se non serve
}

function recordBatterySample(level) {
    const now = new Date();
    const ts = formatLocalTimestamp(now);
    recordedData.push({
        timestamp: ts,
        bpm: null,
        rr_ms: null,
        rmssd: null,
        sdnn: null,
        nn50: null,
        pnn50: null,
        hrvIndex: null,
        lfhf: null,
        lfhfSmoothed: null,
        lfPower: null,
        hfPower: null,
        windowQualityPct: null,
        battery: level,
        marker: null
    });
    setChartControlsEnabled(true);
    if (currentMetric === 'battery') {
        // reset placeholder finestra per batteria: manteniamo solo valori reali
        const allNull = heartRateChart.data.datasets[0].data.every(v => v == null);
        if (allNull) {
            heartRateChart.data.labels = [];
            heartRateChart.data.datasets[0].data = [];
        }
        if (!batteryStartLabel) batteryStartLabel = extractTimeLabel(ts);
        heartRateChart.data.labels.push(extractTimeLabel(ts));
        heartRateChart.data.datasets[0].data.push(level);
        heartRateChart.update('none');
    }
}
updateLiveIndicator(false);

function updateParamControlsVisibility() {
    const isHrvMetric = ['nn50', 'rmssd', 'sdnn', 'pnn50', 'hrvIndex', 'spectrum'].includes(currentMetric);
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
windowSelect.addEventListener('change', async () => {
    const val = Number(windowSelect.value);
    if (!Number.isNaN(val) && val > 0) {
        lfhfWindowSeconds = val;
        await runWithProcessing(async () => {
            await recomputeMetricsForRecordedData();
            updateHrvMetrics();
            redrawChartForMetric();
        });
    }
});
outlierAbsSelect.addEventListener('change', async () => {
    const val = Number(outlierAbsSelect.value);
    if (!Number.isNaN(val) && val > 0) {
        outlierAbsMs = val;
        await runWithProcessing(async () => {
            await recomputeMetricsForRecordedData();
            updateHrvMetrics();
            redrawChartForMetric();
        });
    }
});
outlierRelSelect.addEventListener('change', async () => {
    const val = Number(outlierRelSelect.value);
    if (!Number.isNaN(val) && val > 0) {
        outlierRel = val;
        await runWithProcessing(async () => {
            await recomputeMetricsForRecordedData();
            updateHrvMetrics();
            redrawChartForMetric();
        });
    }
});
resampleSelect.addEventListener('change', async () => {
    const val = Number(resampleSelect.value);
    if (!Number.isNaN(val) && val > 0) {
        resampleHz = val;
        await runWithProcessing(async () => {
            await recomputeMetricsForRecordedData();
            updateHrvMetrics();
            redrawChartForMetric();
        });
    }
});

updateParamControlsVisibility();

// --- CONTROLLI UI (download, reset, impostazioni) ---
function slugifyLabel(label) {
    return String(label || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function getPolarMetricLabel() {
    if (metricSelect && metricSelect.selectedIndex >= 0) {
        return metricSelect.options[metricSelect.selectedIndex].textContent || currentMetric;
    }
    return currentMetric;
}

function getNextPolarSessionId() {
    return pad2(polarSessionCounter++);
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

function buildPolarCurrentCsvContent(options = {}) {
    const { silent = false } = options;
    let header = '';
    let rows = '';
    if (currentMetric === 'rr') {
        header = 'timestamp,rr_ms,marker\n';
        rows = recordedData.map(d => `${d.timestamp},${d.rr_ms ?? ''},${d.marker ?? ''}`).join('\n');
    } else if (currentMetric === 'bpm') {
        header = 'timestamp,bpm,marker\n';
        rows = recordedData.map(d => `${d.timestamp},${d.bpm ?? ''},${d.marker ?? ''}`).join('\n');
    } else if (currentMetric === 'nn50') {
        header = 'timestamp,nn50,marker\n';
        rows = recordedData.map(d => `${d.timestamp},${d.nn50 ?? ''},${d.marker ?? ''}`).join('\n');
    } else if (currentMetric === 'battery') {
        header = 'timestamp,battery_pct,marker\n';
        rows = recordedData.map(d => `${d.timestamp},${d.battery ?? ''},${d.marker ?? ''}`).join('\n');
    } else if (currentMetric === 'rmssd') {
        header = 'timestamp,rmssd_ms,marker\n';
        rows = recordedData.map(d => `${d.timestamp},${(d.rmssd != null && !Number.isNaN(d.rmssd)) ? d.rmssd.toFixed(2) : ''},${d.marker ?? ''}`).join('\n');
    } else if (currentMetric === 'sdnn') {
        header = 'timestamp,sdnn_ms,marker\n';
        rows = recordedData.map(d => `${d.timestamp},${(d.sdnn != null && !Number.isNaN(d.sdnn)) ? d.sdnn.toFixed(2) : ''},${d.marker ?? ''}`).join('\n');
    } else if (currentMetric === 'pnn50') {
        header = 'timestamp,pnn50_percent,marker\n';
        rows = recordedData.map(d => `${d.timestamp},${(d.pnn50 != null && !Number.isNaN(d.pnn50)) ? d.pnn50.toFixed(2) : ''},${d.marker ?? ''}`).join('\n');
    } else if (currentMetric === 'hrvIndex') {
        header = 'timestamp,hrv_index_ms,marker\n';
        rows = recordedData.map(d => `${d.timestamp},${(d.hrvIndex != null && !Number.isNaN(d.hrvIndex)) ? d.hrvIndex.toFixed(2) : ''},${d.marker ?? ''}`).join('\n');
    } else if (currentMetric === 'spectrum') {
        const windowed = getWindowedRrSeries(lfhfWindowSeconds);
        const spec = computeSpectrumFromSeries(windowed);
        if (!spec || !spec.freqs || !spec.freqs.length) {
            if (!silent) {
                alert('Nessun dato di spettro disponibile per questa finestra.');
            }
            return null;
        }
        header = 'freq_hz,power\n';
        rows = spec.freqs.map((f, idx) => `${f.toFixed(4)},${spec.powers[idx].toExponential(6)}`).join('\n');
    }
    return header + rows;
}

function buildPolarAllCsvContent() {
    const header = 'timestamp,bpm,rr_ms,rmssd_ms,sdnn_ms,nn50,pnn50_percent,hrv_index_ms,lfhf_ratio,lfhf_smoothed,lf_power,hf_power,window_quality_pct,battery_pct,battery_pct_last,marker,config_outlier_abs_ms,config_outlier_rel,config_resample_hz,config_window_s\n';
    let lastBattery = null;
    const rows = recordedData.map(d => {
        const bpm = d.bpm ?? '';
        const rr = d.rr_ms ?? '';
        const rmssdStr = (d.rmssd != null && !Number.isNaN(d.rmssd)) ? d.rmssd.toFixed(2) : '';
        const sdnnStr = (d.sdnn != null && !Number.isNaN(d.sdnn)) ? d.sdnn.toFixed(2) : '';
        const nn50Str = (d.nn50 != null && !Number.isNaN(d.nn50)) ? d.nn50.toString() : '';
        const pnn50Str = (d.pnn50 != null && !Number.isNaN(d.pnn50)) ? d.pnn50.toFixed(2) : '';
        const hrvStr = (d.hrvIndex != null && !Number.isNaN(d.hrvIndex)) ? d.hrvIndex.toFixed(2) : '';
        const lfhfStr = (d.lfhf != null && !Number.isNaN(d.lfhf)) ? d.lfhf.toFixed(3) : '';
        const lfhfSmoothStr = (d.lfhfSmoothed != null && !Number.isNaN(d.lfhfSmoothed)) ? d.lfhfSmoothed.toFixed(3) : '';
        const lfStr = (d.lfPower != null && !Number.isNaN(d.lfPower)) ? d.lfPower.toExponential(6) : '';
        const hfStr = (d.hfPower != null && !Number.isNaN(d.hfPower)) ? d.hfPower.toExponential(6) : '';
        const qualityStr = (d.windowQualityPct != null && !Number.isNaN(d.windowQualityPct)) ? d.windowQualityPct.toFixed(2) : '';
        const batteryStr = (d.battery != null && !Number.isNaN(d.battery)) ? d.battery : '';
        if (d.battery != null && !Number.isNaN(d.battery)) {
            lastBattery = d.battery;
        }
        const batteryLastStr = (lastBattery != null && !Number.isNaN(lastBattery)) ? lastBattery : '';
        const markerStr = d.marker ?? '';
        return `${d.timestamp},${bpm},${rr},${rmssdStr},${sdnnStr},${nn50Str},${pnn50Str},${hrvStr},${lfhfStr},${lfhfSmoothStr},${lfStr},${hfStr},${qualityStr},${batteryStr},${batteryLastStr},${markerStr},${outlierAbsMs},${outlierRel},${resampleHz},${lfhfWindowSeconds}`;
    }).join('\n');
    return header + rows;
}

function buildPolarLegacyCsvContent() {
    const header = 'time,ecg,hr,rr,marker\n';
    const rows = recordedData.map(d => {
        const dateMs = d.timestamp ? Date.parse(d.timestamp.replace(' ', 'T')) : null;
        const timeMicro = dateMs ? Math.round(dateMs * 1000) : '';
        const hr = d.bpm != null && !Number.isNaN(d.bpm) ? d.bpm : '';
        const rr = d.rr_ms != null && !Number.isNaN(d.rr_ms) ? d.rr_ms : '';
        const marker = d.marker ?? '';
        return `${timeMicro},,${hr},${rr},${marker}`;
    }).join('\n');
    return header + rows;
}

function downloadPolarCsvBundle() {
    if (!recordedData.length) {
        alert('Nessun dato da esportare');
        return;
    }
    const currentContent = buildPolarCurrentCsvContent();
    if (!currentContent) return;
    const fullContent = buildPolarAllCsvContent();
    const legacyContent = buildPolarLegacyCsvContent();
    const sessionId = getNextPolarSessionId();
    const dateStr = formatFileTimestamp(new Date());
    const baseName = `session${sessionId}-${dateStr}-polar`;
    const metricLabel = slugifyLabel(getPolarMetricLabel()) || currentMetric || 'current';
    const zipBlob = createZipBlob([
        { name: `${baseName}-full.csv`, content: fullContent },
        { name: `${baseName}-${metricLabel}.csv`, content: currentContent },
        { name: `${baseName}-legacy.csv`, content: legacyContent }
    ]);
    downloadBlob(zipBlob, `${baseName}.zip`);
}

if (downloadButton) {
    downloadButton.addEventListener('click', downloadPolarCsvBundle);
}

if (markerButton) {
    markerButton.addEventListener('click', addMarker);
}

if (chartScrollInput) {
    chartScrollInput.addEventListener('input', () => {
        debugWindowStart = Number(chartScrollInput.value) || 0;
        redrawChartForMetric();
    });
}


if (settingsButton && settingsMenu) {
    settingsButton.addEventListener('click', () => {
        const isOpen = settingsMenu.classList.toggle('open');
        settingsButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
        if (!settingsMenu.contains(e.target) && !settingsButton.contains(e.target)) {
            settingsMenu.classList.remove('open');
            settingsButton.setAttribute('aria-expanded', 'false');
        }
    });
    settingsMenu.addEventListener('mouseleave', () => {
        settingsMenu.classList.remove('open');
        settingsButton.setAttribute('aria-expanded', 'false');
    });
}

function applyAnalysisParamsFromUI() {
    const windowVal = Number(windowSelect?.value);
    const outlierAbsVal = Number(outlierAbsSelect?.value);
    const outlierRelVal = Number(outlierRelSelect?.value);
    const resampleVal = Number(resampleSelect?.value);
    if (!Number.isNaN(windowVal) && windowVal > 0) lfhfWindowSeconds = windowVal;
    if (!Number.isNaN(outlierAbsVal) && outlierAbsVal > 0) outlierAbsMs = outlierAbsVal;
    if (!Number.isNaN(outlierRelVal) && outlierRelVal > 0) outlierRel = outlierRelVal;
    if (!Number.isNaN(resampleVal) && resampleVal > 0) resampleHz = resampleVal;
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

function recomputeMetricsForRecordedDataSync() {
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
        row.rmssd = null;
        row.sdnn = null;
        row.pnn50 = null;
        row.hrvIndex = null;
        row.lfhf = null;
        row.lfhfSmoothed = null;
        row.lfPower = null;
        row.hfPower = null;
        row.windowQualityPct = null;
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

async function recomputeMetricsForRecordedData() {
    if (!recordedData.length) return;
    if (!polarWorker) {
        recomputeMetricsForRecordedDataSync();
        return;
    }
    const requestId = ++polarWorkerRequestId;
    polarWorkerLatest = requestId;
    // annulla promesse pendenti più vecchie
    polarWorkerPending.forEach((pending) => pending.cancel());
    polarWorkerPending.clear();
    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
        };
        const fallback = (reason) => {
            if (settled) return;
            if (polarWorkerPending.has(requestId)) {
                polarWorkerPending.delete(requestId);
            }
            console.warn('Polar worker fallback', reason);
            try {
                recomputeMetricsForRecordedDataSync();
            } catch (err) {
                console.error('Polar worker fallback failed', err);
            }
            finish();
        };
        const timeoutId = setTimeout(() => fallback('timeout'), POLAR_WORKER_TIMEOUT_MS);
        polarWorkerPending.set(requestId, {
            resolve: () => {
                clearTimeout(timeoutId);
                finish();
            },
            reject: (err) => {
                clearTimeout(timeoutId);
                fallback(err || 'error');
            },
            cancel: () => {
                clearTimeout(timeoutId);
                finish();
            }
        });
        polarWorker.postMessage({
            type: 'recompute',
            requestId,
            data: recordedData,
            params: {
                lfhfWindowSeconds,
                outlierAbsMs,
                outlierRel,
                resampleHz,
                lfhfSmoothingWindow
            }
        });
    });
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

async function startBatteryPolling(server) {
    try {
        const batteryService = await server.getPrimaryService(BATTERY_SERVICE_UUID);
        batteryCharacteristic = await batteryService.getCharacteristic(BATTERY_LEVEL_CHAR_UUID);
        const value = await batteryCharacteristic.readValue();
        const level = value.getUint8(0);
        updatePolarBattery(level);
        recordBatterySample(level);
        if (batteryPollTimer) clearInterval(batteryPollTimer);
        batteryPollTimer = setInterval(async () => {
            if (!batteryCharacteristic) return;
            try {
                const val = await batteryCharacteristic.readValue();
                const lvl = val.getUint8(0);
                updatePolarBattery(lvl);
                recordBatterySample(lvl);
            } catch (e) {
                // ignore read errors
            }
        }, BATTERY_POLL_MS);
    } catch (e) {
        batteryCharacteristic = null;
        if (batteryPollTimer) {
            clearInterval(batteryPollTimer);
            batteryPollTimer = null;
        }
        updatePolarBattery(null);
    }
}

function stopBatteryPolling() {
    if (batteryPollTimer) {
        clearInterval(batteryPollTimer);
        batteryPollTimer = null;
    }
    batteryCharacteristic = null;
    updatePolarBattery(null);
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
const chartCanvas = ctx.canvas;
const markerOverlay = document.getElementById('markerOverlay');

const heartRateChart = new Chart(ctx, {
    type: 'line', 
    data: {
        labels: [], 
        datasets: [
            {
                label: 'Intervallo R-R (ms)', 
                data: [], 
                borderColor: '#0a84ff',
                backgroundColor: 'rgba(10, 132, 255, 0.16)',
                borderWidth: 2,
                tension: 0.1,
                showLine: true,
                spanGaps: true,
                pointRadius: 1
            },
            {
                label: 'Marker',
                data: [],
                borderColor: '#ff9f0a',
                backgroundColor: '#ff9f0a',
                showLine: false,
                spanGaps: false,
                pointRadius: 0,
                pointStyle: 'triangle',
                tension: 0,
                borderWidth: 0,
                borderDash: [4, 4],
                hoverRadius: 8,
                hitRadius: 10
            }
        ]
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
            legend: { display: false },
            customMarkers: {}
        },
        animation: false 
    }
});
updateChartStyleForMetric();
seedChartWindow();
drawMarkerOverlay();

// Marker su click del grafico: prende il punto più vicino e assegna un marker numerato
function handleChartClick(evt) {
    if (!heartRateChart) return;
    const points = heartRateChart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true);
    if (!points || !points.length) return;
    const idx = points[0].index;
    const labelsCount = heartRateChart.data.labels.length;
    const globalIdx = recordedData.length - labelsCount + idx;
    if (globalIdx < 0 || globalIdx >= recordedData.length) return;
    recordedData[globalIdx].marker = markerCounter++;
    rebuildMarkersDataset();
    heartRateChart.update();
    requestAnimationFrame(drawMarkerOverlay);
}
// Disabilitato click sul grafico per aggiungere marker (solo pulsante)

function seedChartWindow(windowSize = CHART_WINDOW_POINTS) {
    if (!heartRateChart) return;
    heartRateChart.data.labels = new Array(windowSize).fill('');
    heartRateChart.data.datasets[0].data = new Array(windowSize).fill(null);
    heartRateChart.data.datasets[1].data = [];
    drawMarkerOverlay();
}

// --- LOGICA BLUETOOTH ---

modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        setMode(mode);
    });
});

window.addEventListener('resize', () => {
    drawMarkerOverlay();
});

connectButton.addEventListener('click', () => {
    if (currentMode !== 'live') return;
    if (isConnected) {
        const confirmed = window.confirm('Disconnettendo il sensore i dati rimarranno visibili ma non saranno più in tempo reale');
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
        const confirmed = window.confirm('Passando alla modalità debug tutti i dati della sessione live verranno cancellati');
        if (!confirmed) return;
    } else if (currentMode === 'debug' && mode === 'live') {
        const confirmed = window.confirm('Passando alla modalità live tutte le modifiche apportate al CSV verranno perse');
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
        // riattiva il pulsante download
        if (downloadButton) {
            downloadButton.style.display = 'flex';
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

        // assicura che il pulsante CSV sia cliccabile
        setCsvLoading(false);

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
    // assicura stato pulito e abilita di nuovo il picker
    isCsvLoading = false;
    if (loadCsvButton) {
        loadCsvButton.disabled = false;
        loadCsvButton.textContent = 'Carica CSV';
        loadCsvButton.classList.remove('is-loading');
        loadCsvButton.setAttribute('aria-busy', 'false');
    }
    csvInput.value = '';
    csvInput.click();
});

csvInput.addEventListener('change', async (e) => {
    if (currentMode !== 'debug') return;
    const file = e.target.files[0];
    if (!file) return;
    setCsvLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            await loadCsvDataFromText(ev.target.result);
        } finally {
            setCsvLoading(false);
        }
    };
    reader.onerror = () => {
        alert('Errore nella lettura del file CSV.');
        setCsvLoading(false);
    };
    reader.readAsText(file);
});

function enableDropZone(enabled) {
    if (!chartDropZone) return;
    chartDropZone.hidden = !enabled;
    chartDropZone.style.opacity = enabled ? '1' : '0';
}

['dragenter', 'dragover'].forEach(evt => {
    document.addEventListener(evt, (e) => {
        if (currentMode !== 'debug') return;
        if (!chartDropZone) return;
        if (!e.dataTransfer || !e.dataTransfer.items || e.dataTransfer.items.length === 0) return;
        e.preventDefault();
        chartDropZone.hidden = false;
        chartDropZone.style.opacity = '1';
    });
});

['dragleave', 'drop'].forEach(evt => {
    document.addEventListener(evt, (e) => {
        if (!chartDropZone) return;
        if (evt === 'dragleave' && chartDropZone.contains(e.target)) return;
        chartDropZone.hidden = true;
        chartDropZone.style.opacity = '0';
    });
});

document.addEventListener('drop', async (e) => {
    if (currentMode !== 'debug') return;
    if (!chartDropZone) return;
    e.preventDefault();
    chartDropZone.hidden = true;
    chartDropZone.style.opacity = '0';
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    setCsvLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            await loadCsvDataFromText(ev.target.result);
        } finally {
            setCsvLoading(false);
        }
    };
    reader.onerror = () => {
        alert('Errore nella lettura del file CSV.');
        setCsvLoading(false);
    };
    reader.readAsText(file);
});

function setCsvLoading(state) {
    isCsvLoading = state;
    if (loadCsvButton) {
        loadCsvButton.disabled = state;
        loadCsvButton.textContent = state ? 'Caricamento…' : 'Carica CSV';
        loadCsvButton.classList.toggle('is-loading', state);
        loadCsvButton.setAttribute('aria-busy', state ? 'true' : 'false');
    }
}

function applyMarkerState() {
    if (!markerButton) return;
    const enabled = chartControlsEnabled && markerActive;
    markerButton.disabled = !enabled;
    markerButton.classList.toggle('disabled', !enabled);
    markerButton.setAttribute('aria-disabled', (!enabled).toString());
}

function isDebugScrollableMetric() {
    return currentMode === 'debug' && currentMetric !== 'battery' && currentMetric !== 'spectrum';
}

function updateChartWindowStart() {
    if (!heartRateChart) return;
    if (isDebugScrollableMetric()) {
        const maxStart = Math.max(0, recordedData.length - CHART_WINDOW_POINTS);
        chartWindowStartIdx = Math.min(debugWindowStart, maxStart);
        return;
    }
    const labelsLen = heartRateChart.data.labels?.length || 0;
    chartWindowStartIdx = Math.max(0, recordedData.length - labelsLen);
}

function updateChartScrollState() {
    if (!chartScroll || !chartScrollInput) return;
    const maxStart = Math.max(0, recordedData.length - CHART_WINDOW_POINTS);
    const shouldShow = isDebugScrollableMetric() && maxStart > 0;
    chartScroll.hidden = !shouldShow;
    if (!shouldShow) {
        debugWindowStart = 0;
        return;
    }
    if (debugWindowStart > maxStart) debugWindowStart = maxStart;
    chartScrollInput.min = '0';
    chartScrollInput.max = `${maxStart}`;
    chartScrollInput.step = '1';
    chartScrollInput.value = `${debugWindowStart}`;
}

function startMarkerCooldown(durationMs = MARKER_COOLDOWN_MS) {
    if (!markerButton) return;
    markerActive = false;
    if (markerCooldownTimer) clearTimeout(markerCooldownTimer);
    markerCooldownTimer = setTimeout(() => {
        markerCooldownTimer = null;
        markerActive = true;
        applyMarkerState();
    }, durationMs);
    applyMarkerState();
}

function setChartControlsEnabled(enabled) {
    chartControlsEnabled = enabled;
    const iconButtons = [settingsButton, downloadButton];
    iconButtons.forEach(btn => {
        if (!btn) return;
        btn.disabled = !enabled;
        btn.classList.toggle('disabled', !enabled);
        btn.setAttribute('aria-disabled', (!enabled).toString());
    });
    applyMarkerState();
    const selects = [metricSelect, windowSelect, outlierAbsSelect, outlierRelSelect, resampleSelect];
    selects.forEach(sel => {
        if (!sel) return;
        sel.disabled = !enabled;
        sel.classList.toggle('disabled', !enabled);
        sel.setAttribute('aria-disabled', (!enabled).toString());
    });
    if (!enabled) {
        if (settingsMenu) settingsMenu.classList.remove('open');
        if (settingsButton) settingsButton.setAttribute('aria-expanded', 'false');
    }
}

function showAllMetricOptions() {
    if (!metricSelect) return;
    Array.from(metricSelect.options).forEach(opt => {
        opt.hidden = false;
        opt.disabled = false;
    });
}

function setMetricOptionsVisibilityForDebug(options = {}) {
    const { forceFirst = false } = options;
    if (!metricSelect) return;
    if (currentMode !== 'debug') {
        showAllMetricOptions();
        return;
    }
    if (!recordedData.length) {
        showAllMetricOptions();
        return;
    }
    let hasBpm = false;
    let hasRr = false;
    let hasRmssd = false;
    let hasSdnn = false;
    let hasNn50 = false;
    let hasPnn50 = false;
    let hasHrv = false;
    let hasSpectrum = false;
    let hasBattery = false;

    recordedData.forEach(d => {
        if (d.bpm != null && !Number.isNaN(d.bpm)) hasBpm = true;
        if (d.rr_ms != null && !Number.isNaN(d.rr_ms)) hasRr = true;
        if (d.rmssd != null && !Number.isNaN(d.rmssd)) hasRmssd = true;
        if (d.sdnn != null && !Number.isNaN(d.sdnn)) hasSdnn = true;
        if (d.nn50 != null && !Number.isNaN(d.nn50)) hasNn50 = true;
        if (d.pnn50 != null && !Number.isNaN(d.pnn50)) hasPnn50 = true;
        if (d.hrvIndex != null && !Number.isNaN(d.hrvIndex)) hasHrv = true;
        if ((d.lfPower != null && !Number.isNaN(d.lfPower)) || (d.hfPower != null && !Number.isNaN(d.hfPower))) hasSpectrum = true;
        if (d.battery != null && !Number.isNaN(d.battery)) hasBattery = true;
    });

    const availability = {
        bpm: hasBpm,
        rr: hasRr,
        rmssd: hasRmssd,
        sdnn: hasSdnn,
        nn50: hasNn50,
        pnn50: hasPnn50,
        spectrum: hasSpectrum,
        hrvIndex: hasHrv,
        battery: hasBattery
    };

    let firstAvailable = null;
    Array.from(metricSelect.options).forEach(opt => {
        const available = availability[opt.value] !== false; // default true if non mappato
        opt.hidden = !available;
        opt.disabled = !available;
        if (available && !firstAvailable) firstAvailable = opt.value;
    });

    const selectedOption = Array.from(metricSelect.options).find(opt => opt.value === metricSelect.value);
    const selectedAvailable = selectedOption ? !selectedOption.disabled : false;
    const targetMetric = forceFirst ? firstAvailable : (!selectedAvailable ? firstAvailable : null);
    if (targetMetric && metricSelect.value !== targetMetric) {
        metricSelect.value = targetMetric;
        currentMetric = targetMetric;
    }
}

function setProcessing(state) {
    isProcessing = state;
    if (processingIndicator) {
        processingIndicator.hidden = !state;
    }
}

async function runWithProcessing(fn) {
    setProcessing(true);
    // forza il repaint prima del lavoro pesante
    await new Promise(requestAnimationFrame);
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
        await fn();
    } finally {
        setProcessing(false);
    }
}

try {
    polarWorker = new Worker(new URL('../workers/polarWorker.js', import.meta.url), { type: 'module' });
    polarWorker.onmessage = (e) => {
        const { type, requestId, data, lfhfHistory: history, message } = e.data || {};
        if (type === 'done') {
            const pending = polarWorkerPending.get(requestId);
            polarWorkerPending.delete(requestId);
            if (!pending) return;
            if (requestId < polarWorkerLatest) {
                pending.resolve();
                return;
            }
            if (data) {
                recordedData = data;
                lfhfHistory = history || [];
            }
            pending.resolve();
        } else if (type === 'error') {
            const pending = polarWorkerPending.get(requestId);
            polarWorkerPending.delete(requestId);
            if (pending) pending.reject(new Error(message || 'Errore worker'));
        }
    };
    polarWorker.onerror = (err) => {
        console.error('Polar worker error', err);
        polarWorkerPending.forEach((pending) => pending.reject(err));
        polarWorkerPending.clear();
        try {
            polarWorker.terminate();
        } catch (e) {
            console.warn('Impossibile terminare il worker Polar', e);
        }
        polarWorker = null;
    };
} catch (e) {
    console.warn('Worker non disponibile, uso calcolo sul main thread', e);
    polarWorker = null;
}

async function loadCsvDataFromText(text) {
    try {
    const hadPreviousData = recordedData.length > 0;
    clearMeasurementData();
    recordedData = [];
    rrSeries = [];
    maxBpm = null;
    maxBpmTimestamp = null;
    minBpm = null;
    minBpmTimestamp = null;
    applyAnalysisParamsFromUI();

    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
        alert('Il file CSV non contiene dati sufficienti.');
        return;
    }

    const header = lines[0].split(',');
    const idxTimestamp = header.indexOf('timestamp');
    const idxTimeCompat = header.indexOf('time'); // formato app concorrente
    const idxEcgCompat = header.indexOf('ecg');
    const idxHrCompat = header.indexOf('hr');
    const idxRrCompat = header.indexOf('rr');
    const idxMarker = header.indexOf('marker');
    const idxBpm = header.indexOf('bpm');
    const idxRr = header.indexOf('rr_ms');
    const idxRmssd = header.indexOf('rmssd_ms');
    const idxSdnn = header.indexOf('sdnn_ms');
    const idxPnn50 = header.indexOf('pnn50_percent');
    const idxHrv = header.indexOf('hrv_index_ms');
    const idxBattery = header.indexOf('battery_pct');
    const isEcgLoggerCsv = idxEcgCompat !== -1 && idxTimeCompat !== -1 && idxTimestamp === -1;

    if (idxTimestamp === -1 && idxTimeCompat === -1) {
        alert('CSV non valido: manca la colonna "timestamp" o \"time\".');
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

        let ts = '';
        if (idxTimestamp !== -1) {
            ts = cols[idxTimestamp] || '';
        } else if (idxTimeCompat !== -1) {
            const raw = cols[idxTimeCompat];
            const numeric = raw ? Number(raw) : null;
            if (numeric && !Number.isNaN(numeric)) {
                let millis;
                if (numeric > 1e17) {
                    millis = numeric / 1e6; // nanosecondi -> ms
                } else if (numeric > 1e14) {
                    millis = numeric / 1e3; // microsecondi -> ms
                } else if (numeric > 1e12) {
                    millis = numeric; // già ms
                } else if (numeric > 1e9) {
                    millis = numeric * 1000; // secondi -> ms
                } else {
                    millis = numeric;
                }
                const dt = new Date(millis);
                ts = formatLocalTimestamp(dt);
            }
        }
        const bpm = (idxBpm !== -1 && cols[idxBpm] !== '') ? Number(cols[idxBpm]) : ((idxHrCompat !== -1 && cols[idxHrCompat] !== '') ? Number(cols[idxHrCompat]) : null);
        const rr = (idxRr !== -1 && cols[idxRr] !== '') ? Number(cols[idxRr]) : ((idxRrCompat !== -1 && cols[idxRrCompat] !== '') ? Number(cols[idxRrCompat]) : null);
        const rmssd = (idxRmssd !== -1 && cols[idxRmssd] !== '') ? Number(cols[idxRmssd]) : null;
        const sdnn = (idxSdnn !== -1 && cols[idxSdnn] !== '') ? Number(cols[idxSdnn]) : null;
        const pnn50 = (idxPnn50 !== -1 && cols[idxPnn50] !== '') ? Number(cols[idxPnn50]) : null;
        const hrvIndex = (idxHrv !== -1 && cols[idxHrv] !== '') ? Number(cols[idxHrv]) : null;
        const battery = (idxBattery !== -1 && cols[idxBattery] !== '') ? Number(cols[idxBattery]) : null;
        const marker = (idxMarker !== -1 && cols[idxMarker] !== '') ? cols[idxMarker] : null;

        const hasMetricValue = (
            (bpm != null && !Number.isNaN(bpm)) ||
            (rr != null && !Number.isNaN(rr)) ||
            (rmssd != null && !Number.isNaN(rmssd)) ||
            (sdnn != null && !Number.isNaN(sdnn)) ||
            (pnn50 != null && !Number.isNaN(pnn50)) ||
            (hrvIndex != null && !Number.isNaN(hrvIndex)) ||
            (battery != null && !Number.isNaN(battery)) ||
            (marker != null && marker !== '')
        );
        if (isEcgLoggerCsv && !hasMetricValue) {
            continue;
        }
        if (ts) {
            if (!firstTimestampStr) firstTimestampStr = ts;
            lastTimestampStr = ts;
        }

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
            windowQualityPct: null,
            battery: battery,
            marker: marker
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

    debugWindowStart = Math.max(0, recordedData.length - CHART_WINDOW_POINTS);
    // Ricalcolo dopo import (niente overlay di ricalcolo: usiamo solo lo stato di caricamento CSV)
    await recomputeMetricsForRecordedData();
    updateHrvMetrics();
    setMetricOptionsVisibilityForDebug({ forceFirst: hadPreviousData });
    redrawChartForMetric();
    if (recordedData.length > 0) {
        setChartControlsEnabled(true);
    }

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
    } finally {
        if (isCsvLoading) setCsvLoading(false);
        if (isProcessing) setProcessing(false);
    }
}

async function connectToDevice() {
    try {
        statoEl.textContent = 'Ricerca dispositivo...';
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [HR_SERVICE_UUID] }],
            optionalServices: [BATTERY_SERVICE_UUID]
        });

        statoEl.textContent = 'Connessione al GATT server...';
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(HR_SERVICE_UUID);
        const characteristic = await service.getCharacteristic(HR_MEASUREMENT_CHAR_UUID);

        await characteristic.startNotifications();
        startBatteryPolling(server);
        statoEl.textContent = 'Connesso';
        statusLed.classList.add('connected');
        isConnected = true;
        connectedDevice = device;
        connectButton.textContent = 'Disconnetti';
        connectButton.classList.add('disconnect');
        updateLiveIndicator(true);
        clearMeasurementData();
        startMarkerCooldown();
        setChartControlsEnabled(true);

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
    stopBatteryPolling();

    if (connectionTimerId) {
        clearInterval(connectionTimerId);
        connectionTimerId = null;
    }
    connectionStartTime = null;

    // Non cancelliamo i valori mostrati nei tab o nel grafico:
    // manteniamo bpm, intervallo R-R, BPM max/min, HRV, serie RR e dati registrati.

    isPaused = false;

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
                    windowQualityPct: null,
                    battery: null,
                    marker: null
                };
                recordedData.push(dataPoint);
                setChartControlsEnabled(true);

                const windowMetrics = computeHrvMetricsFromSeries(getWindowedRrSeries(lfhfWindowSeconds));
                if (windowMetrics) {
                    dataPoint.rmssd = windowMetrics.rmssd;
                    dataPoint.sdnn = windowMetrics.sdnn;
                    dataPoint.nn50 = windowMetrics.nn50;
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
                        valueForChart = windowMetrics ? windowMetrics.rmssd : dataPoint.rmssd;
                        break;
                    case 'sdnn':
                        valueForChart = windowMetrics ? windowMetrics.sdnn : dataPoint.sdnn;
                        break;
                    case 'nn50':
                        valueForChart = windowMetrics ? windowMetrics.nn50 : dataPoint.nn50;
                        break;
                    case 'pnn50':
                        valueForChart = windowMetrics ? windowMetrics.pnn50 : dataPoint.pnn50;
                        break;
                    case 'hrvIndex':
                        valueForChart = windowMetrics ? windowMetrics.hrvIndex : dataPoint.hrvIndex;
                        break;
                }

                if (!isPaused && valueForChart != null && !Number.isNaN(valueForChart)) {
                    heartRateChart.data.labels.push(extractTimeLabel(timestamp));
                    heartRateChart.data.datasets[0].data.push(valueForChart);

                    if (heartRateChart.data.labels.length > CHART_WINDOW_POINTS) {
                        heartRateChart.data.labels.shift();
                        heartRateChart.data.datasets[0].data.shift();
                        if (heartRateChart.data.datasets[1].data.length > 0) {
                            // ricostruzione dopo shift
                            rebuildMarkersDataset();
                        }
                    }

                    chartUpdated = true;
                    const nowTs = Date.now();
                    const shouldUpdate = currentMetric === 'battery' || (nowTs - lastPolarRedrawTs >= POLAR_REDRAW_MS);
                    if (shouldUpdate) {
                        lastPolarRedrawTs = nowTs;
                        rebuildMarkersDataset();
                        heartRateChart.update('none');
                        chartUpdated = false;
                    }
                }
            });

            updateHrvMetrics();

            if (chartUpdated && (currentMetric !== 'battery')) {
                const nowTs = Date.now();
                if (nowTs - lastPolarRedrawTs >= POLAR_REDRAW_MS) {
                    lastPolarRedrawTs = nowTs;
                    rebuildMarkersDataset();
                    heartRateChart.update('none');
                }
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

function getValueForCurrentMetric(d) {
    switch (currentMetric) {
        case 'rr':
            return d.rr_ms;
        case 'bpm':
            return d.bpm;
        case 'nn50':
            return d.nn50;
        case 'rmssd':
            return d.rmssd;
        case 'sdnn':
            return d.sdnn;
        case 'pnn50':
            return d.pnn50;
        case 'hrvIndex':
            return d.hrvIndex;
        case 'battery':
            return d.battery;
        default:
            return null;
    }
}

function isBatteryOnlyRow(row) {
    if (!row) return false;
    if (row.battery == null || Number.isNaN(row.battery)) return false;
    const keys = [
        'bpm',
        'rr_ms',
        'rmssd',
        'sdnn',
        'nn50',
        'pnn50',
        'hrvIndex',
        'lfhf',
        'lfhfSmoothed',
        'lfPower',
        'hfPower',
        'windowQualityPct'
    ];
    return keys.every((key) => row[key] == null || Number.isNaN(row[key]));
}

function rebuildMarkersDataset() {
    if (!heartRateChart || !heartRateChart.scales?.y) return;
    updateChartWindowStart();
    const labels = heartRateChart.data.labels;
    const markers = [];
    const slice = recordedData.slice(chartWindowStartIdx, chartWindowStartIdx + labels.length);
    slice.forEach((d, idx) => {
        if (d && d.marker != null && d.marker !== '') {
            markers.push({ xIndex: idx, marker: d.marker });
        }
    });
    heartRateChart.data.datasets[1].data = markers;
    requestAnimationFrame(drawMarkerOverlay);
}

function drawMarkerOverlay() {
    if (!markerOverlay || !heartRateChart || !heartRateChart.scales?.x || !heartRateChart.scales?.y) return;
    const xScale = heartRateChart.scales.x;
    const yScale = heartRateChart.scales.y;
    const ctxOv = markerOverlay.getContext('2d');
    const rect = chartCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    markerOverlay.width = rect.width * dpr;
    markerOverlay.height = rect.height * dpr;
    markerOverlay.style.width = `${rect.width}px`;
    markerOverlay.style.height = `${rect.height}px`;
    ctxOv.save();
    ctxOv.scale(dpr, dpr);
    ctxOv.clearRect(0, 0, rect.width, rect.height);

    const yTop = yScale.top;
    const yBottom = yScale.bottom;

    const markers = heartRateChart.data.datasets[1].data || [];
    if (!markers.length) {
        ctxOv.restore();
        return;
    }

    ctxOv.setLineDash([6, 6]);
    ctxOv.strokeStyle = '#ff9f0a';
    ctxOv.lineWidth = 1;
    ctxOv.fillStyle = '#ff9f0a';
    markers.forEach((pt) => {
        if (!pt || pt.xIndex == null) return;
        const x = xScale.getPixelForValue(pt.xIndex);
        // linea verticale
        ctxOv.beginPath();
        ctxOv.moveTo(x, yTop);
        ctxOv.lineTo(x, yBottom);
        ctxOv.stroke();
        // triangolo in alto
        const triH = 10;
        const triW = 12;
        ctxOv.beginPath();
        ctxOv.moveTo(x, yTop + triH);
        ctxOv.lineTo(x - triW / 2, yTop);
        ctxOv.lineTo(x + triW / 2, yTop);
        ctxOv.closePath();
        ctxOv.fill();
    });
    ctxOv.restore();
}

function exportCSV(mode, options = {}) {
    const { silent = false } = options;
    if (recordedData.length === 0) {
        if (!silent) {
            alert('Nessun dato da esportare');
        }
        return false;
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
        } else if (currentMetric === 'nn50') {
            header = 'timestamp,nn50\n';
            rows = recordedData.map(d => `${d.timestamp},${d.nn50 ?? ''}`).join('\n');
        } else if (currentMetric === 'battery') {
            header = 'timestamp,battery_pct\n';
            rows = recordedData.map(d => `${d.timestamp},${d.battery ?? ''}`).join('\n');
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
                if (!silent) {
                    alert('Nessun dato di spettro disponibile per questa finestra.');
                    return false;
                }
                header = 'freq_hz,power\n';
                rows = '';
            } else {
                header = 'freq_hz,power\n';
                rows = spec.freqs.map((f, idx) => `${f.toFixed(4)},${spec.powers[idx].toExponential(6)}`).join('\n');
            }
        }
    } else {
        header = 'timestamp,bpm,rr_ms,rmssd_ms,sdnn_ms,nn50,pnn50_percent,hrv_index_ms,lfhf_ratio,lfhf_smoothed,lf_power,hf_power,window_quality_pct,battery_pct,battery_pct_last,marker,config_outlier_abs_ms,config_outlier_rel,config_resample_hz,config_window_s\n';
        let lastBattery = null;
        rows = recordedData.map(d => {
            const bpm = d.bpm ?? '';
            const rr = d.rr_ms ?? '';
            const rmssdStr = (d.rmssd != null && !Number.isNaN(d.rmssd)) ? d.rmssd.toFixed(2) : '';
            const sdnnStr = (d.sdnn != null && !Number.isNaN(d.sdnn)) ? d.sdnn.toFixed(2) : '';
            const nn50Str = (d.nn50 != null && !Number.isNaN(d.nn50)) ? d.nn50.toString() : '';
            const pnn50Str = (d.pnn50 != null && !Number.isNaN(d.pnn50)) ? d.pnn50.toFixed(2) : '';
            const hrvStr = (d.hrvIndex != null && !Number.isNaN(d.hrvIndex)) ? d.hrvIndex.toFixed(2) : '';
            const lfhfStr = (d.lfhf != null && !Number.isNaN(d.lfhf)) ? d.lfhf.toFixed(3) : '';
            const lfhfSmoothStr = (d.lfhfSmoothed != null && !Number.isNaN(d.lfhfSmoothed)) ? d.lfhfSmoothed.toFixed(3) : '';
            const lfStr = (d.lfPower != null && !Number.isNaN(d.lfPower)) ? d.lfPower.toExponential(6) : '';
            const hfStr = (d.hfPower != null && !Number.isNaN(d.hfPower)) ? d.hfPower.toExponential(6) : '';
            const qualityStr = (d.windowQualityPct != null && !Number.isNaN(d.windowQualityPct)) ? d.windowQualityPct.toFixed(2) : '';
            const batteryStr = (d.battery != null && !Number.isNaN(d.battery)) ? d.battery : '';
            if (d.battery != null && !Number.isNaN(d.battery)) {
                lastBattery = d.battery;
            }
            const batteryLastStr = (lastBattery != null && !Number.isNaN(lastBattery)) ? lastBattery : '';
            const markerStr = d.marker ?? '';
            return `${d.timestamp},${bpm},${rr},${rmssdStr},${sdnnStr},${nn50Str},${pnn50Str},${hrvStr},${lfhfStr},${lfhfSmoothStr},${lfStr},${hfStr},${qualityStr},${batteryStr},${batteryLastStr},${markerStr},${outlierAbsMs},${outlierRel},${resampleHz},${lfhfWindowSeconds}`;
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
    return true;
}

function exportCompetitorCSV(options = {}) {
    const { silent = false } = options;
    if (recordedData.length === 0) {
        if (!silent) {
            alert('Nessun dato da esportare');
        }
        return false;
    }

    const header = 'time,ecg,hr,rr,marker\n';
    const rows = recordedData.map(d => {
        const dateMs = d.timestamp ? Date.parse(d.timestamp.replace(' ', 'T')) : null;
        const timeMicro = dateMs ? Math.round(dateMs * 1000) : '';
        const hr = d.bpm != null && !Number.isNaN(d.bpm) ? d.bpm : '';
        const rr = d.rr_ms != null && !Number.isNaN(d.rr_ms) ? d.rr_ms : '';
        const marker = d.marker ?? '';
        return `${timeMicro},,${hr},${rr},${marker}`;
    }).join('\n');

    const csvContent = header + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `ecglogger_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
}

function redrawChartForMetric() {
    const scrollableDebug = isDebugScrollableMetric();
    const windowLimit = currentMetric === 'battery' ? Infinity : CHART_WINDOW_POINTS;
    heartRateChart.data.labels = [];
    heartRateChart.data.datasets[0].data = [];
    heartRateChart.data.datasets[1].data = [];

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
        heartRateChart.data.datasets[1].data = [];
        updateChartStyleForMetric();
        heartRateChart.update();
        updateChartScrollState();
        return;
    }

    heartRateChart.config.type = 'line';

    let sliceStart = 0;
    let sliceEnd = recordedData.length;
    if (windowLimit !== Infinity) {
        if (scrollableDebug) {
            const maxStart = Math.max(0, recordedData.length - windowLimit);
            sliceStart = Math.min(debugWindowStart, maxStart);
            sliceEnd = Math.min(recordedData.length, sliceStart + windowLimit);
        } else {
            sliceStart = Math.max(0, recordedData.length - windowLimit);
        }
    }
    chartWindowStartIdx = sliceStart;
    const dataSlice = recordedData.slice(sliceStart, sliceEnd);
    let lastValidValue = null;
    dataSlice.forEach(d => {
        const value = getValueForCurrentMetric(d);
        if (currentMetric === 'battery') {
            if (value != null && !Number.isNaN(value)) {
                heartRateChart.data.labels.push(extractTimeLabel(d.timestamp));
                heartRateChart.data.datasets[0].data.push(value);
            }
            return;
        }
        heartRateChart.data.labels.push(extractTimeLabel(d.timestamp));
        if (value != null && !Number.isNaN(value)) {
            lastValidValue = value;
            heartRateChart.data.datasets[0].data.push(value);
        } else if (isBatteryOnlyRow(d) && lastValidValue != null) {
            heartRateChart.data.datasets[0].data.push(lastValidValue);
        } else {
            heartRateChart.data.datasets[0].data.push(null);
        }
    });
    heartRateChart.data.datasets[1].data = [];

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
            // scala più zommata per vedere variazioni minute
            yMin = 45;
            yMax = 130;
            yLabel = 'Battito (BPM)';
            break;
        case 'battery':
            yMin = 0;
            yMax = 110; // più aria sopra al 100% per evitare sovrapposizioni
            yLabel = 'Batteria (%)';
            break;
        case 'nn50':
            yMin = 0;
            yMax = 60; // scala più compatta (coppie) per evitare appiattimento
            yLabel = 'NN50 (coppie)';
            break;
        case 'rmssd':
            yMin = 0;
            yMax = 150;
            yLabel = 'RMSSD (ms)';
            break;
        case 'sdnn':
            yMin = 0;
            yMax = 150;
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
    updateChartScrollState();
    rebuildMarkersDataset();
}

function addMarker() {
    if (markerCooldownTimer || !markerActive) return;
    if (recordedData.length === 0 || !heartRateChart) {
        alert('Nessun dato disponibile per inserire un marker.');
        return;
    }
    const labels = heartRateChart.data.labels || [];
    const values = heartRateChart.data.datasets[0]?.data || [];
    // trova l'ultimo punto valido visibile sul chart
    let idx = -1;
    for (let i = values.length - 1; i >= 0; i--) {
        const v = values[i];
        if (v != null && !Number.isNaN(v)) {
            idx = i;
            break;
        }
    }
    if (idx === -1) {
        alert('Nessun dato disponibile per inserire un marker.');
        return;
    }
    updateChartWindowStart();
    const globalIdx = chartWindowStartIdx + idx;
    if (globalIdx < 0 || globalIdx >= recordedData.length) {
        alert('Nessun dato disponibile per inserire un marker.');
        return;
    }
    recordedData[globalIdx].marker = markerCounter++;
    rebuildMarkersDataset();
    heartRateChart.update();
}

// Inizializzazioni
updateParamControlsVisibility();
updateLiveIndicator(false);
setMode('live');
if (metricSelect) {
    metricSelect.value = currentMetric;
    redrawChartForMetric();
}
initObdModule();
initPhyphoxModule();
initOsmo360Module();

if (lfhfToggle && lfhfPanel) {
    const togglePanel = () => {
        const isOpen = lfhfPanel.classList.toggle('open');
        lfhfToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const caret = lfhfToggle.querySelector('.caret');
        if (caret) caret.textContent = isOpen ? '▴' : '▾';
    };
    lfhfToggle.addEventListener('click', togglePanel);
    lfhfToggle.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePanel();
        }
    });
}
if (museBandsToggle && museBandsPanel) {
    const togglePanel = () => {
        const isOpen = museBandsPanel.classList.toggle('open');
        museBandsToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const caret = museBandsToggle.querySelector('.caret');
        if (caret) caret.textContent = isOpen ? '▴' : '▾';
    };
    museBandsToggle.addEventListener('click', togglePanel);
    museBandsToggle.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePanel();
        }
    });
}
if (obdMoreToggle && obdMorePanel) {
    const togglePanel = () => {
        const isOpen = obdMorePanel.classList.toggle('open');
        obdMoreToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const caret = obdMoreToggle.querySelector('.caret');
        if (caret) caret.textContent = isOpen ? '▴' : '▾';
    };
    obdMoreToggle.addEventListener('click', togglePanel);
    obdMoreToggle.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePanel();
        }
    });
}
if (phyphoxMoreToggle && phyphoxMorePanel) {
    const togglePanel = () => {
        const isOpen = phyphoxMorePanel.classList.toggle('open');
        phyphoxMoreToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const caret = phyphoxMoreToggle.querySelector('.caret');
        if (caret) caret.textContent = isOpen ? '▴' : '▾';
    };
    phyphoxMoreToggle.addEventListener('click', togglePanel);
    phyphoxMoreToggle.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePanel();
        }
    });
}

// Disabilita controlli al primo load
setChartControlsEnabled(false);
enableDropZone(false);
