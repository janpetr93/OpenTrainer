import {
  DEFAULT_INTENSITY_PERCENT,
  FREE_RIDE_BIG_STEP_WATTS,
  FREE_RIDE_SMALL_STEP_WATTS,
  INTENSITY_BIG_STEP,
  INTENSITY_SMALL_STEP,
  MAX_INTENSITY_PERCENT,
  MIN_INTENSITY_PERCENT,
} from './domain/rideIntensity'

type WorkoutProps = {
  mode: 'workout'
  intensityPercent: number
  onNudge: (delta: number) => void
  onReset: () => void
}

type FreeRideProps = {
  mode: 'freeRide'
  targetWatts: number | null
  ftpWatts: number | null
  onNudge: (delta: number) => void
}

type Props = (WorkoutProps | FreeRideProps) & {
  /** False when the trainer cannot take ERG targets on this connection. */
  ergAvailable: boolean
}

function signed(n: number, unit: string): string {
  return `${n > 0 ? '+' : '−'}${Math.abs(n)}${unit}`
}

/**
 * Ride Intensity for a Workout (percent of plan) or the ERG target for a
 * Free Ride (watts). Keyboard shortcuts are handled app-wide in App.
 */
export function RideIntensityControl(props: Props) {
  const workout = props.mode === 'workout'
  const small = workout ? INTENSITY_SMALL_STEP : FREE_RIDE_SMALL_STEP_WATTS
  const big = workout ? INTENSITY_BIG_STEP : FREE_RIDE_BIG_STEP_WATTS
  const unit = workout ? '%' : ' W'
  const steps = [-big, -small, small, big]

  let value: string
  let detail: string | null = null
  let changed = false
  let atMin = false
  let atMax = false
  if (props.mode === 'workout') {
    value = `${props.intensityPercent}%`
    changed = props.intensityPercent !== DEFAULT_INTENSITY_PERCENT
    detail = changed ? 'of plan' : 'as planned'
    atMin = props.intensityPercent <= MIN_INTENSITY_PERCENT
    atMax = props.intensityPercent >= MAX_INTENSITY_PERCENT
  } else {
    value = props.targetWatts === null ? 'Off' : `${props.targetWatts} W`
    if (props.targetWatts === null) {
      detail = 'first press holds your power'
    } else if (props.ftpWatts !== null && props.ftpWatts > 0) {
      detail = `${Math.round((props.targetWatts / props.ftpWatts) * 100)}% FTP`
    }
  }

  const keys = workout
    ? '↑/↓ ±1% · Shift ±5% · R reset'
    : '↑/↓ ±5 W · Shift ±25 W'

  return (
    <section
      className="ride-intensity"
      data-changed={changed ? 'true' : undefined}
      aria-label={workout ? 'Ride Intensity' : 'Free Ride target'}
    >
      <div className="ride-intensity-row">
        <span className="ride-intensity-label">
          {workout ? 'Intensity' : 'ERG target'}
        </span>
        {steps.slice(0, 2).map((delta) => (
          <button
            key={delta}
            type="button"
            className="ride-intensity-step"
            disabled={atMin}
            aria-label={`${workout ? 'Intensity' : 'Target'} ${signed(delta, unit)}`}
            onClick={() => props.onNudge(delta)}
          >
            {signed(delta, unit)}
          </button>
        ))}
        <output className="ride-intensity-value" aria-live="polite">
          <strong>{value}</strong>
          {detail && <span className="muted">{detail}</span>}
        </output>
        {steps.slice(2).map((delta) => (
          <button
            key={delta}
            type="button"
            className="ride-intensity-step"
            disabled={atMax}
            aria-label={`${workout ? 'Intensity' : 'Target'} ${signed(delta, unit)}`}
            onClick={() => props.onNudge(delta)}
          >
            {signed(delta, unit)}
          </button>
        ))}
        {props.mode === 'workout' && (
          <button
            type="button"
            className="ride-intensity-reset"
            disabled={!changed}
            onClick={props.onReset}
          >
            Reset 100%
          </button>
        )}
      </div>
      <p className="ride-intensity-hint muted">
        {props.ergAvailable
          ? `Keys work on any tab: ${keys}`
          : `Trainer ERG not available — targets are display-only. ${keys}`}
      </p>
    </section>
  )
}
