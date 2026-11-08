import { describe, expect, it } from 'vitest'
import { parseCadenceHelperEvent } from '../src/cadenceProtocol.js'

describe('parseCadenceHelperEvent', () => {
  it('reads a discovered peripheral', () => {
    expect(
      parseCadenceHelperEvent(
        '{"event":"device","id":"abc","name":"","rssi":-40,"connectable":true,"services":["1816"],"companyId":null}',
      ),
    ).toEqual({
      event: 'device',
      id: 'abc',
      name: '',
      rssi: -40,
      connectable: true,
      services: ['1816'],
      companyId: null,
    })
  })

  it('reads a measurement and a connect result', () => {
    expect(parseCadenceHelperEvent('{"event":"measurement","bytes":[2,1,0,0,4]}')).toEqual({
      event: 'measurement',
      bytes: [2, 1, 0, 0, 4],
    })
    expect(parseCadenceHelperEvent('{"event":"connected","id":"abc","name":"CADENCE"}')).toEqual({
      event: 'connected',
      id: 'abc',
      name: 'CADENCE',
    })
  })

  it('ignores lines that are not events', () => {
    expect(parseCadenceHelperEvent('')).toBeNull()
    expect(parseCadenceHelperEvent('not json')).toBeNull()
    expect(parseCadenceHelperEvent('{"event":"measurement","bytes":[300]}')).toBeNull()
  })
})
