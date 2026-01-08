# Muse Athena S Bridge (macOS)

Bridge locale in Swift che usa `Muse.framework` (SDK macOS) per collegare Muse Athena S via BLE e inoltrare i pacchetti al browser tramite WebSocket (`ws://localhost:3002`). Pensato per allinearsi agli altri sensori (Live/Debug) della dashboard.

> **Nota:** il framework proprietario non è incluso. Devi copiarlo/collegarlo in locale e compilare con Xcode/Swift. Non committare `tmp/` o il framework.

## Prerequisiti
- macOS con Xcode/Swift toolchain.
- `Muse.framework` dall’SDK (atteso in `private/vendor/muse/Muse.framework`).
- Permessi Bluetooth abilitati per l’eseguibile.

## Setup rapido
1) Copia o collega il framework accanto al bridge:
```
cd backend/bridges/muse
ln -s ../../../private/vendor/muse/Muse.framework .
```

2) Compila l’eseguibile CLI:
```
swiftc -F . -framework Muse -o bridge main.swift
```
Se preferisci Xcode, crea un “Command Line Tool” in Swift, aggiungi `Muse.framework` a “Frameworks, Libraries and Embedded Content” e sostituisci `main.swift` con questo file.

3) Esegui il bridge (porta WS di default 3002):
```
./bridge
```
Opzioni:
```
MUSE_WS_PORT=3002 ./bridge
```

4) Frontend: connetti a `ws://localhost:3002` per ricevere pacchetti JSON:
```json
{
  "type": "data",
  "muse": "Muse-XXXX",
  "packetType": "eeg",
  "timestamp": 123456789,
  "values": [/* numeri */]
}
```
Altri messaggi: `type:"muse_list"`, `type:"connection"`, `type:"error"`, `type:"log"`.

## Stato
- Bridge minimale, un solo client WS contemporaneo (il browser).
- Registra tutte le tipologie supportate da `IXNMuseDataPacketType` e trasmette `values()` grezzi.
- Nessun parsing specifico per canali/grafici: il frontend potrà scegliere come usare i valori.
- Modalità Debug da implementare nel frontend via CSV (come Polar/OBD).

## TODO possibili
- Gestire più client WS (broadcast).
- Rate-limiting / filtraggio per pacchetti ad alta frequenza (EEG/acc/gyro).
- Esposizione di preset/parametri (notch, preset 21, ecc.) via messaggi WS dal browser.
- Firma del binario / richiesta permessi Bluetooth automatica.
