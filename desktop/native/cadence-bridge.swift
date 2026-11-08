import CoreBluetooth
import Darwin
import Foundation

/// Stdio bridge so the Electron main process can scan and connect a cadence
/// sensor without Web Bluetooth's advertisement filter.
///
/// Commands (one JSON object per line on stdin):
///   {"cmd":"scan"}
///   {"cmd":"connect","id":"<uuid>"}
///   {"cmd":"disconnect"}
///   {"cmd":"stop"}
///   {"cmd":"shutdown"}
///
/// Events (one JSON object per line on stdout): ready, device, connected,
/// measurement, disconnected, error.

setvbuf(stdout, nil, _IONBF, 0)

func emit(_ object: [String: Any]) {
    guard JSONSerialization.isValidJSONObject(object),
          let data = try? JSONSerialization.data(withJSONObject: object),
          let line = String(data: data, encoding: .utf8)
    else { return }
    print(line)
    fflush(stdout)
}

func isCsc(_ uuid: CBUUID) -> Bool {
    let value = uuid.uuidString.uppercased()
    return value == "1816" || value == "00001816-0000-1000-8000-00805F9B34FB"
}

func isCscMeasurement(_ uuid: CBUUID) -> Bool {
    let value = uuid.uuidString.uppercased()
    return value == "2A5B" || value == "00002A5B-0000-1000-8000-00805F9B34FB"
}

final class Bridge: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    let central: CBCentralManager
    var peripherals: [UUID: CBPeripheral] = [:]
    var names: [UUID: String] = [:]
    var connected: CBPeripheral?
    var pendingConnect: UUID?
    var scanWhenReady = false
    var loggedMeasurement = false

    override init() {
        central = CBCentralManager(delegate: nil, queue: nil)
        super.init()
        central.delegate = self
    }

    func handle(_ object: [String: Any]) {
        switch object["cmd"] as? String {
        case "scan":
            scanWhenReady = true
            startScan()
        case "connect":
            if let id = object["id"] as? String, let uuid = UUID(uuidString: id) {
                connect(uuid)
            } else {
                emit(["event": "error", "message": "Missing cadence sensor id."])
            }
        case "disconnect":
            disconnect()
        case "stop":
            scanWhenReady = false
            central.stopScan()
        case "shutdown":
            disconnect()
            exit(0)
        default:
            emit(["event": "error", "message": "Unknown cadence scanner command."])
        }
    }

    func startScan() {
        guard central.state == .poweredOn else { return }
        central.scanForPeripherals(
            withServices: nil,
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
        )
    }

    func connect(_ id: UUID) {
        guard let peripheral = peripherals[id] else {
            emit(["event": "error", "message": "That cadence sensor is no longer advertising. Spin the crank and try again."])
            return
        }
        central.stopScan()
        scanWhenReady = false
        pendingConnect = id
        connected = peripheral
        loggedMeasurement = false
        peripheral.delegate = self
        central.connect(peripheral, options: nil)
    }

    func disconnect() {
        pendingConnect = nil
        if let peripheral = connected {
            central.cancelPeripheralConnection(peripheral)
        }
        connected = nil
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            emit(["event": "ready"])
            if scanWhenReady { startScan() }
        case .unauthorized:
            emit([
                "event": "error",
                "message": "macOS blocked Bluetooth for the cadence scanner. Allow OpenTrainer under System Settings → Privacy & Security → Bluetooth, then try again.",
            ])
        case .poweredOff:
            emit(["event": "error", "message": "Bluetooth is off. Turn it on and try again."])
        default:
            break
        }
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        let id = peripheral.identifier
        peripherals[id] = peripheral
        let advertised = advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? ""
        let name = advertised.isEmpty ? (peripheral.name ?? "") : advertised
        if names[id] == name, names[id] != nil { return }
        if let previous = names[id], previous.isEmpty == false || name.isEmpty { return }
        names[id] = name

        let listed = (advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] ?? [])
            + (advertisementData[CBAdvertisementDataOverflowServiceUUIDsKey] as? [CBUUID] ?? [])
        let services = listed.map(\.uuidString)
        var company: Any = NSNull()
        if let data = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data, data.count >= 2 {
            company = Int(data[0]) | (Int(data[1]) << 8)
        }
        let connectable = (advertisementData[CBAdvertisementDataIsConnectable] as? NSNumber)?.boolValue ?? false
        emit([
            "event": "device",
            "id": id.uuidString,
            "name": name,
            "rssi": RSSI.intValue,
            "connectable": connectable,
            "services": services,
            "companyId": company,
        ])
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.discoverServices(nil)
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        pendingConnect = nil
        connected = nil
        let detail = error?.localizedDescription ?? "the connection failed"
        emit(["event": "error", "message": "Could not connect to the cadence sensor: \(detail)"])
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        let wasPending = pendingConnect == peripheral.identifier
        if connected?.identifier == peripheral.identifier {
            connected = nil
        }
        pendingConnect = nil
        if wasPending, error != nil {
            emit(["event": "error", "message": "The cadence sensor disconnected before it was ready."])
            return
        }
        emit(["event": "disconnected"])
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error {
            fail(peripheral, error.localizedDescription)
            return
        }
        guard let service = peripheral.services?.first(where: { isCsc($0.uuid) }) else {
            fail(peripheral, "This device has no cadence service.")
            return
        }
        peripheral.discoverCharacteristics(nil, for: service)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if let error {
            fail(peripheral, error.localizedDescription)
            return
        }
        guard let characteristic = service.characteristics?.first(where: { isCscMeasurement($0.uuid) }) else {
            fail(peripheral, "This device has no cadence measurement.")
            return
        }
        // Notify before the descriptors are known can report success and then
        // never deliver a value. Discover them first, then switch notifications on.
        if characteristic.descriptors == nil {
            peripheral.discoverDescriptors(for: characteristic)
            return
        }
        peripheral.setNotifyValue(true, for: characteristic)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverDescriptorsFor characteristic: CBCharacteristic, error: Error?) {
        guard isCscMeasurement(characteristic.uuid) else { return }
        if let error {
            fputs("descriptor discovery: \(error.localizedDescription)\n", stderr)
        }
        peripheral.setNotifyValue(true, for: characteristic)
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateNotificationStateFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        if let error {
            fail(peripheral, error.localizedDescription)
            return
        }
        guard characteristic.isNotifying else { return }
        pendingConnect = nil
        let name = peripheral.name ?? names[peripheral.identifier] ?? ""
        emit(["event": "connected", "id": peripheral.identifier.uuidString, "name": name])
        emitMeasurement(characteristic)
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        if let error {
            emit(["event": "error", "message": error.localizedDescription])
            return
        }
        emitMeasurement(characteristic)
    }

    func emitMeasurement(_ characteristic: CBCharacteristic) {
        guard isCscMeasurement(characteristic.uuid), let value = characteristic.value, !value.isEmpty else { return }
        if !loggedMeasurement {
            loggedMeasurement = true
            let hex = value.map { String(format: "%02x", $0) }.joined(separator: " ")
            fputs("measurement \(hex)\n", stderr)
        }
        emit(["event": "measurement", "bytes": value.map { Int($0) }])
    }

    func fail(_ peripheral: CBPeripheral, _ message: String) {
        pendingConnect = nil
        emit(["event": "error", "message": message])
        central.cancelPeripheralConnection(peripheral)
    }
}

let bridge = Bridge()

DispatchQueue.global(qos: .userInitiated).async {
    while let line = readLine() {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { continue }
        guard let data = trimmed.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            emit(["event": "error", "message": "The cadence scanner ignored a bad command."])
            continue
        }
        DispatchQueue.main.async {
            bridge.handle(object)
        }
    }
    DispatchQueue.main.async {
        exit(0)
    }
}

RunLoop.main.run()
