import { describe, expect, it } from 'vitest'
import { interpretControlPointResponse } from './controlProbe'

describe('interpretControlPointResponse', () => {
  it('reports success for Result Code Success', () => {
    // Response: 0x80, request opcode, result 0x01 Success
    const view = new DataView(Uint8Array.of(0x80, 0x00, 0x01).buffer)
    expect(interpretControlPointResponse(view)).toEqual({
      requestOpcode: 0x00,
      ok: true,
      resultCode: 0x01,
      message: 'Success',
    })
  })

  it('reports a readable failure for unsupported opcode', () => {
    const view = new DataView(Uint8Array.of(0x80, 0x05, 0x02).buffer)
    const result = interpretControlPointResponse(view)
    expect(result.ok).toBe(false)
    expect(result.requestOpcode).toBe(0x05)
    expect(result.message).toMatch(/not supported/i)
  })
})
