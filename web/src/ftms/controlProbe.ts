export const CONTROL_OP_REQUEST_CONTROL = 0x00
export const CONTROL_OP_SET_TARGET_POWER = 0x05
export const CONTROL_OP_RESPONSE = 0x80

export const RESULT_SUCCESS = 0x01
export const RESULT_NOT_SUPPORTED = 0x02
export const RESULT_INVALID_PARAMETER = 0x03
export const RESULT_OPERATION_FAILED = 0x04
export const RESULT_CONTROL_NOT_PERMITTED = 0x05

const RESULT_MESSAGES: Record<number, string> = {
  [RESULT_SUCCESS]: 'Success',
  [RESULT_NOT_SUPPORTED]: 'Opcode not supported',
  [RESULT_INVALID_PARAMETER]: 'Invalid parameter',
  [RESULT_OPERATION_FAILED]: 'Operation failed',
  [RESULT_CONTROL_NOT_PERMITTED]: 'Control not permitted',
}

export type ControlPointInterpretation = {
  requestOpcode: number
  ok: boolean
  resultCode: number
  message: string
}

export function interpretControlPointResponse(
  view: DataView,
): ControlPointInterpretation {
  if (view.byteLength < 3 || view.getUint8(0) !== CONTROL_OP_RESPONSE) {
    return {
      requestOpcode: -1,
      ok: false,
      resultCode: -1,
      message: 'Unexpected control-point response format',
    }
  }

  const requestOpcode = view.getUint8(1)
  const resultCode = view.getUint8(2)
  const message =
    RESULT_MESSAGES[resultCode] ?? `Unknown result code 0x${resultCode.toString(16)}`

  return {
    requestOpcode,
    ok: resultCode === RESULT_SUCCESS,
    resultCode,
    message,
  }
}

export function buildRequestControlCommand(): BufferSource {
  return new Uint8Array([CONTROL_OP_REQUEST_CONTROL]).buffer
}

export function buildSetTargetPowerCommand(watts: number): BufferSource {
  const clamped = Math.max(0, Math.min(65535, Math.round(watts)))
  const buffer = new ArrayBuffer(3)
  const view = new DataView(buffer)
  view.setUint8(0, CONTROL_OP_SET_TARGET_POWER)
  view.setUint16(1, clamped, true)
  return buffer
}
