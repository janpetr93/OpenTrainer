import { describe, expect, it } from 'vitest'
import { cadenceCandidates, type ScannedPeripheral } from '../src/cadenceCandidates.js'

function device(partial: Partial<ScannedPeripheral> & Pick<ScannedPeripheral, 'id'>): ScannedPeripheral {
  return {
    name: '',
    rssi: -60,
    connectable: true,
    services: [],
    companyId: null,
    ...partial,
  }
}

describe('cadenceCandidates', () => {
  it('lists a sensor that advertises the cadence service even with no name', () => {
    expect(
      cadenceCandidates([
        device({ id: 'csc', rssi: -95, services: ['1816'] }),
      ]),
    ).toEqual([{ id: 'csc', name: 'Cadence sensor' }])
  })

  it('lists a strong unnamed non-Apple peripheral, the shape of the Van Rysel sensor', () => {
    expect(cadenceCandidates([device({ id: 'near', rssi: -42 })])).toEqual([
      { id: 'near', name: '' },
    ])
  })

  it('drops Apple devices, the trainer, weak signals, and a sensor that will not connect', () => {
    expect(
      cadenceCandidates([
        device({ id: 'phone', name: 'Johnathán', companyId: 0x004c, rssi: -15 }),
        device({ id: 'trainer', name: 'VANRYSEL-HT-fc75', rssi: -64 }),
        device({ id: 'far', rssi: -95 }),
        device({ id: 'far-named', name: 'Telka', rssi: -95 }),
        device({ id: 'asleep', connectable: false, services: ['1816'] }),
      ]),
    ).toEqual([])
  })

  it('lists a nearby device whose name is not a known cadence brand', () => {
    expect(cadenceCandidates([device({ id: 'near', name: 'Telka', rssi: -50 })])).toEqual([
      { id: 'near', name: 'Telka' },
    ])
  })

  it('lists a named cadence sensor and a Van Rysel sensor that is not the trainer', () => {
    const listed = cadenceCandidates([
      device({ id: 'bk', name: 'BK467', rssi: -90 }),
      device({ id: 'cd', name: 'VANRYSEL-CD-1', rssi: -70 }),
    ])
    expect(listed.map((entry) => entry.id).sort()).toEqual(['bk', 'cd'])
  })

  it('puts a cadence-service device ahead of a closer unnamed one', () => {
    expect(
      cadenceCandidates([
        device({ id: 'near', rssi: -40 }),
        device({ id: 'csc', rssi: -70, services: ['00001816-0000-1000-8000-00805f9b34fb'] }),
      ]).map((entry) => entry.id),
    ).toEqual(['csc', 'near'])
  })

  it('keeps a name that arrives after the first unnamed advertisement', () => {
    expect(
      cadenceCandidates([
        device({ id: 'same', name: '', rssi: -70 }),
        device({ id: 'same', name: 'CADENCE', rssi: -65 }),
      ]),
    ).toEqual([{ id: 'same', name: 'CADENCE' }])
  })
})
