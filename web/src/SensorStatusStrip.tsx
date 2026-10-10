export type SensorStatusItem = {
  id: string
  label: string
  connectionState: string
  deviceName: string | null
}

type Props = {
  sensors: SensorStatusItem[]
  ftpWatts?: number | null
}

function shortState(state: string): string {
  if (state === 'connected') return 'ok'
  if (state === 'disconnected-with-reconnect') return 'reconnect'
  if (state === 'connecting') return '…'
  return 'off'
}

export function SensorStatusStrip({ sensors, ftpWatts }: Props) {
  return (
    <div className="sensor-status-strip" aria-label="Sensor status">
      <ul className="sensor-pills">
        {sensors.map((sensor) => {
          const title = [
            sensor.label,
            sensor.connectionState.replaceAll('-', ' '),
            sensor.deviceName,
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <li
              key={sensor.id}
              className="sensor-pill"
              data-state={sensor.connectionState}
              title={title}
            >
              <span className="sensor-pill-dot" aria-hidden="true" />
              <span className="sensor-pill-label">{sensor.label}</span>
              <span className="sensor-pill-state">
                {shortState(sensor.connectionState)}
              </span>
            </li>
          )
        })}
      </ul>
      {ftpWatts != null && (
        <p className="sensor-ftp muted">FTP {ftpWatts} W</p>
      )}
    </div>
  )
}
