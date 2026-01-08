# Backend bridges

Servizi bridge locali che parlano con i sensori e forniscono WebSocket/SDK al frontend.

## Struttura
- `bridges/obd/`: bridge Node per OBD-II (ELM327 Wi-Fi -> WebSocket) con le sue dipendenze in `bridges/obd/package.json` / `package-lock.json` / `node_modules/`.
- `bridges/muse/`: bridge Swift verso Muse Athena S (richiede `private/vendor/muse/Muse.framework` symlinkato qui).

## Uso rapido
- OBD: `WS_PORT=3001 node bridges/obd/bridge.js` (configura `OBD_HOST`/`OBD_PORT` se serve). Le dipendenze sono in `bridges/obd/node_modules/`.
- Muse: vedi `bridges/muse/README.md`.

## Note
- Se il repo resta privato puoi mantenere `node_modules` versionata; altrimenti, rigenera con `npm ci` dentro `bridges/obd/`.
- Dipendenze muse (Swift) restano in `bridges/muse/` e non usano npm.
