const textEncoder = new TextEncoder();

function getDosDateTime(date) {
    const dt = date instanceof Date ? date : new Date();
    let year = dt.getFullYear();
    if (year < 1980) year = 1980;
    const month = dt.getMonth() + 1;
    const day = dt.getDate();
    const hours = dt.getHours();
    const minutes = dt.getMinutes();
    const seconds = Math.floor(dt.getSeconds() / 2);
    const dosDate = ((year - 1980) << 9) | (month << 5) | day;
    const dosTime = (hours << 11) | (minutes << 5) | seconds;
    return { dosDate, dosTime };
}

const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function buildLocalHeader(nameBytes, crc, size, dosTime, dosDate) {
    const total = 30 + nameBytes.length;
    const buffer = new ArrayBuffer(total);
    const view = new DataView(buffer);
    let offset = 0;
    view.setUint32(offset, 0x04034b50, true); offset += 4;
    view.setUint16(offset, 20, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, dosTime, true); offset += 2;
    view.setUint16(offset, dosDate, true); offset += 2;
    view.setUint32(offset, crc, true); offset += 4;
    view.setUint32(offset, size, true); offset += 4;
    view.setUint32(offset, size, true); offset += 4;
    view.setUint16(offset, nameBytes.length, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    const header = new Uint8Array(buffer);
    header.set(nameBytes, offset);
    return header;
}

function buildCentralHeader(nameBytes, crc, size, dosTime, dosDate, localOffset) {
    const total = 46 + nameBytes.length;
    const buffer = new ArrayBuffer(total);
    const view = new DataView(buffer);
    let offset = 0;
    view.setUint32(offset, 0x02014b50, true); offset += 4;
    view.setUint16(offset, 20, true); offset += 2;
    view.setUint16(offset, 20, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, dosTime, true); offset += 2;
    view.setUint16(offset, dosDate, true); offset += 2;
    view.setUint32(offset, crc, true); offset += 4;
    view.setUint32(offset, size, true); offset += 4;
    view.setUint32(offset, size, true); offset += 4;
    view.setUint16(offset, nameBytes.length, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint32(offset, 0, true); offset += 4;
    view.setUint32(offset, localOffset, true); offset += 4;
    const header = new Uint8Array(buffer);
    header.set(nameBytes, offset);
    return header;
}

function buildEndOfCentralDirectory(entryCount, centralSize, centralOffset) {
    const buffer = new ArrayBuffer(22);
    const view = new DataView(buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entryCount, true);
    view.setUint16(10, entryCount, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
    view.setUint16(20, 0, true);
    return new Uint8Array(buffer);
}

export function createZipBlob(entries, options = {}) {
    const { date = new Date() } = options;
    const parts = [];
    const centralParts = [];
    let offset = 0;
    entries.forEach((entry) => {
        const nameBytes = textEncoder.encode(entry.name);
        const contentBytes = (entry.content instanceof Uint8Array)
            ? entry.content
            : textEncoder.encode(entry.content ?? '');
        const crc = crc32(contentBytes);
        const size = contentBytes.length;
        const { dosDate, dosTime } = getDosDateTime(entry.date || date);
        const localHeader = buildLocalHeader(nameBytes, crc, size, dosTime, dosDate);
        parts.push(localHeader, contentBytes);
        const centralHeader = buildCentralHeader(nameBytes, crc, size, dosTime, dosDate, offset);
        centralParts.push(centralHeader);
        offset += localHeader.length + contentBytes.length;
    });
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = buildEndOfCentralDirectory(entries.length, centralSize, offset);
    return new Blob([...parts, ...centralParts, end], { type: 'application/zip' });
}
