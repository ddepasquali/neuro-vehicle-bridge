// Worker per calcoli HRV/Spettro off-main-thread

// Utilità tempo (copiate da lib/time.js per evitare import heavy)
function parseTimestampString(ts) {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
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

function cleanRrSeries(series, outlierAbsMs, outlierRel) {
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

function computeSpectrumFromSeries(series, resampleHz, outlierAbsMs, outlierRel) {
    const cleanedRes = cleanRrSeries(series, outlierAbsMs, outlierRel);
    const cleaned = cleanedRes.cleaned;
    const n = cleaned.length;
    if (n < 16) return null;

    const t = new Array(n);
    t[0] = 0;
    for (let i = 1; i < n; i++) {
        t[i] = t[i - 1] + cleaned[i - 1] / 1000;
    }
    const totalTime = t[n - 1];
    const fs = resampleHz;
    const N = Math.floor(totalTime * fs);
    if (N < 32) return null;

    const spline = cubicSplineCoefficients(t, cleaned);
    const rrInterp = new Array(N);
    for (let k = 0; k < N; k++) {
        const tg = k / fs;
        rrInterp[k] = cubicSplineEval(spline, tg);
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

function computeHrvMetricsFromSeries(series, params) {
    const { outlierAbsMs, outlierRel, resampleHz } = params;
    const n = series.length;
    if (n < 2) return null;

    const cleanedRes = cleanRrSeries(series, outlierAbsMs, outlierRel);
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

    const spectrum = computeSpectrumFromSeries(cleaned, resampleHz, outlierAbsMs, outlierRel);
    const lfhf = spectrum ? spectrum.lfhf : null;

    return { rmssd, sdnn, nn50, pnn50, hrvIndex, lfhf, spectrum, rejectedPct: cleanedRes.rejectedPct, windowSamples: cleaned.length };
}

function recomputeRecordedData(data, params) {
    const { lfhfWindowSeconds, lfhfSmoothingWindow } = params;
    const updated = [];
    const windowBuffer = [];
    const lfhfHistory = [];

    for (let i = 0; i < data.length; i++) {
        const row = { ...data[i] };
        const tsDate = parseTimestampString(row.timestamp);
        if (!tsDate) {
            updated.push(row);
            continue;
        }
        while (windowBuffer.length && (tsDate - windowBuffer[0].ts) > lfhfWindowSeconds * 1000) {
            windowBuffer.shift();
        }
        if (row.rr_ms != null && !Number.isNaN(row.rr_ms)) {
            windowBuffer.push({ ts: tsDate, rr: row.rr_ms });
        }
        const windowSeries = windowBuffer.map(x => x.rr);
        const metrics = computeHrvMetricsFromSeries(windowSeries, params);

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
    return { updated, lfhfHistory };
}

self.onmessage = (e) => {
    const { type, requestId, data, params } = e.data || {};
    if (type === 'recompute') {
        try {
            const result = recomputeRecordedData(data || [], params || {});
            self.postMessage({ type: 'done', requestId, data: result.updated, lfhfHistory: result.lfhfHistory });
        } catch (err) {
            self.postMessage({ type: 'error', requestId, message: err?.message || String(err) });
        }
    }
};
