import Foundation
import Network
import CryptoKit
import Muse

// MARK: - Simple WebSocket (server-side, single client)

final class WebSocketServer {
    private let port: NWEndpoint.Port
    private var listener: NWListener?
    private var client: NWConnection?

    init(port: UInt16) {
        self.port = NWEndpoint.Port(rawValue: port) ?? 3002
    }

    func start() {
        do {
            let wsOptions = NWProtocolWebSocket.Options()
            wsOptions.autoReplyPing = true
            let params = NWParameters(tls: nil, tcp: NWProtocolTCP.Options())
            params.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)
            listener = try NWListener(using: params, on: self.port)
        } catch {
            print("Failed to start WS listener: \(error)")
            return
        }
        listener?.newConnectionHandler = { [weak self] nwConn in
            guard let self = self else { return }
            self.client = nwConn
            nwConn.stateUpdateHandler = { state in
                print("[WS] state: \(state)")
            }
            nwConn.start(queue: .main)
            self.receiveLoop(nwConn)
            print("Client connected")
        }
        listener?.start(queue: .main)
        print("WS server on ws://127.0.0.1:\(port.rawValue)")
    }

    private func receiveLoop(_ conn: NWConnection) {
        conn.receiveMessage { [weak self] _, _, _, error in
            if let error = error {
                print("[WS] receive error: \(error)")
                return
            }
            self?.receiveLoop(conn)
        }
    }

    func send(json: [String: Any]) {
        guard let conn = client else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: json, options: []) else { return }
        let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(identifier: "ws-text", metadata: [metadata])
        conn.send(content: data, contentContext: context, isComplete: true, completion: .contentProcessed { _ in })
    }
}

// MARK: - Muse Bridge

final class MuseBridge: NSObject, IXNMuseListener, IXNMuseConnectionListener, IXNMuseDataListener {
    private let museManager: IXNMuseManager
    private let ws: WebSocketServer
    private var muses: [String: IXNMuse] = [:]
    private var isConnecting = false
    private let preferredPreset: IXNMusePreset
    private var lastPpgPacketAt: Int64 = 0
    private var lastDerivedPpgAt: Int64 = 0

    private let dataTypes: [IXNMuseDataPacketType] = [
        // Start with a safe subset to avoid SDK exceptions.
        .eeg,
        .accelerometer,
        .gyro,
        .ppg,
        .optics,
        .battery,
        .alphaAbsolute,
        .betaAbsolute,
        .thetaAbsolute,
        .deltaAbsolute,
        .gammaAbsolute,
        .isHeartGood
    ]

    init(wsPort: UInt16, preset: IXNMusePreset) {
        self.museManager = IXNMuseManagerMac()
        self.ws = WebSocketServer(port: wsPort)
        self.preferredPreset = preset
        super.init()
        museManager.removeFromList(after: 10)
        museManager.setMuseListener(self)
    }

    func start() {
        ws.start()
        museManager.startListening()
        log("Scanning for Muse...")
    }

    // MARK: Muse listener

    func museListChanged() {
        let found = museManager.getMuses()
        muses = Dictionary(uniqueKeysWithValues: found.map { ($0.getMacAddress(), $0) })
        let summary = found.map { ["name": $0.getName(), "mac": $0.getMacAddress()] }
        ws.send(json: ["type": "muse_list", "muses": summary])
        log("Found \(found.count) devices")
        // Auto-connect the first available if not already connecting/connected
        if !isConnecting {
            connectFirstAvailable(preset: preferredPreset)
        }
    }

    // MARK: Connection listener

    func receive(_ packet: IXNMuseConnectionPacket, muse: IXNMuse?) {
        guard let muse = muse else { return }
        let event: [String: Any] = [
            "type": "connection",
            "muse": muse.getMacAddress(),
            "prev": packet.previousConnectionState.rawValue,
            "curr": packet.currentConnectionState.rawValue
        ]
        ws.send(json: event)
        if packet.currentConnectionState == .connected {
            log("\(muse.getName()) connected")
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                guard let self = self else { return }
                if let config = muse.getConfiguration() {
                    self.log("Muse model: \(String(describing: config.getModel())) preset: \(String(describing: config.getPreset()))")
                } else {
                    self.log("Muse configuration not available yet")
                }
            }
        } else if packet.currentConnectionState == .disconnected {
            log("\(muse.getName()) disconnected")
        }
    }

    // MARK: Data listener

    func receive(_ packet: IXNMuseDataPacket?, muse: IXNMuse?) {
        guard let packet = packet, let muse = muse else { return }
        let values = packet.values().map { $0.doubleValue }
        if values.isEmpty { return }
        let packetType = packet.packetType()
        // Alcuni pacchetti (es. PPG) possono arrivare con timestamp 0/negativo: usa tempo locale.
        let ts: Int64 = {
            let raw = packet.timestamp()
            if raw > 0 {
                return raw
            }
            return Int64(Date().timeIntervalSince1970 * 1000)
        }()
        if packetType == .ppg {
            lastPpgPacketAt = ts
        }
        let payload: [String: Any] = [
            "type": "data",
            "muse": muse.getMacAddress(),
            "packetType": packetType.rawValue,
            "packetTypeName": String(describing: packetType),
            "timestamp": ts,
            "values": values
        ]
        ws.send(json: payload)
        if packetType == .optics {
            maybeSendDerivedPpg(from: values, timestamp: ts, muse: muse)
        }
    }

    func receive(_ packet: IXNMuseArtifactPacket, muse: IXNMuse?) {
        let payload: [String: Any] = [
            "type": "artifact",
            "muse": muse?.getMacAddress() ?? "",
            "blink": packet.blink,
            "jawClench": packet.jawClench,
            "headbandOn": packet.headbandOn
        ]
        ws.send(json: payload)
    }

    // MARK: Control

    func connectFirstAvailable(preset: IXNMusePreset = .preset21) {
        guard let muse = museManager.getMuses().first else {
            log("No Muse found yet")
            return
        }
        if muse.getConnectionState() == .connected || muse.getConnectionState() == .connecting {
            return
        }
        isConnecting = true
        muse.unregisterAllListeners()
        muse.enableException(false)
        muse.enableDataTransmission(true)
        muse.register(self)
        dataTypes.forEach { muse.register(self, type: $0) }
        muse.setPreset(preset)
        log("Using preset \(String(describing: preset)) (rawValue \(preset.rawValue))")
        muse.runAsynchronously()
        log("Connecting to \(muse.getName()) (\(muse.getMacAddress()))")
    }

    func disconnectAll() {
        museManager.getMuses().forEach { $0.disconnect() }
        isConnecting = false
    }

    private func log(_ msg: String) {
        print("[MuseBridge] \(msg)")
        ws.send(json: ["type": "log", "message": msg])
    }

    private func derivePpgFromOptics(values: [Double]) -> Double? {
        if values.count >= 16 {
            let redIndices = [8, 9, 12, 13]
            let ambientIndices = [10, 11, 14, 15]
            let red = redIndices.compactMap { $0 < values.count ? values[$0] : nil }
            let ambient = ambientIndices.compactMap { $0 < values.count ? values[$0] : nil }
            return relativeDifferencePercent(numerator: red, denominator: ambient)
        }
        if values.count >= 8 {
            let nm850Indices = [2, 3, 6, 7]
            let nm730Indices = [0, 1, 4, 5]
            let nm850 = nm850Indices.compactMap { $0 < values.count ? values[$0] : nil }
            let nm730 = nm730Indices.compactMap { $0 < values.count ? values[$0] : nil }
            return relativeDifferencePercent(numerator: nm850, denominator: nm730)
        }
        if values.count >= 4 {
            let nm850Indices = [2, 3]
            let nm730Indices = [0, 1]
            let nm850 = nm850Indices.compactMap { $0 < values.count ? values[$0] : nil }
            let nm730 = nm730Indices.compactMap { $0 < values.count ? values[$0] : nil }
            return relativeDifferencePercent(numerator: nm850, denominator: nm730)
        }
        return nil
    }

    private func relativeDifferencePercent(numerator: [Double], denominator: [Double]) -> Double? {
        guard !numerator.isEmpty, !denominator.isEmpty else { return nil }
        let numAvg = numerator.reduce(0, +) / Double(numerator.count)
        let denAvg = denominator.reduce(0, +) / Double(denominator.count)
        let denom = max(abs(denAvg), 1e-6)
        let diff = abs(numAvg - denAvg)
        let pct = (diff / denom) * 100
        if !pct.isFinite { return nil }
        return pct
    }

    private func maybeSendDerivedPpg(from opticsValues: [Double], timestamp: Int64, muse: IXNMuse) {
        if timestamp - lastPpgPacketAt < 1500 { return }
        if timestamp - lastDerivedPpgAt < 100 { return }
        guard let derived = derivePpgFromOptics(values: opticsValues) else { return }
        lastDerivedPpgAt = timestamp
        let payload: [String: Any] = [
            "type": "data",
            "muse": muse.getMacAddress(),
            "packetType": IXNMuseDataPacketType.ppg.rawValue,
            "packetTypeName": String(describing: IXNMuseDataPacketType.ppg),
            "timestamp": timestamp,
            "values": [derived],
            "derived": true
        ]
        ws.send(json: payload)
    }
}

// MARK: - Entry point

let wsPortEnv = ProcessInfo.processInfo.environment["MUSE_WS_PORT"]
let port = UInt16(wsPortEnv ?? "") ?? 3002
let selectedPreset = resolveMusePreset()
let bridge = MuseBridge(wsPort: port, preset: selectedPreset)
bridge.start()

func resolveMusePreset() -> IXNMusePreset {
    let env = ProcessInfo.processInfo.environment["MUSE_PRESET"] ?? ""
    let cleaned = env.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
        .replacingOccurrences(of: "preset", with: "")
    if cleaned.isEmpty { return .preset21 }
    let presetMap: [String: IXNMusePreset] = [
        "10": .preset10,
        "12": .preset12,
        "14": .preset14,
        "20": .preset20,
        "21": .preset21,
        "22": .preset22,
        "23": .preset23,
        "ab": .presetAb,
        "ad": .presetAd,
        "31": .preset31,
        "32": .preset32,
        "50": .preset50,
        "51": .preset51,
        "52": .preset52,
        "53": .preset53,
        "54": .preset54,
        "55": .preset55,
        "60": .preset60,
        "61": .preset61,
        "63": .preset63,
        "1021": .preset1021,
        "1022": .preset1022,
        "1023": .preset1023,
        "1024": .preset1024,
        "1025": .preset1025,
        "1026": .preset1026,
        "1027": .preset1027,
        "1028": .preset1028,
        "1029": .preset1029,
        "102a": .preset102A,
        "1031": .preset1031,
        "1032": .preset1032,
        "1033": .preset1033,
        "1034": .preset1034,
        "1035": .preset1035,
        "1036": .preset1036,
        "1041": .preset1041,
        "1042": .preset1042,
        "1043": .preset1043,
        "1044": .preset1044,
        "1045": .preset1045,
        "1046": .preset1046
    ]
    if let preset = presetMap[cleaned] {
        return preset
    }
    return .preset21
}

// Auto-connect to the first device as soon as it appears.
DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
    bridge.connectFirstAvailable(preset: selectedPreset)
}

RunLoop.main.run()
