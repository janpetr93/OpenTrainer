import { describe, expect, it } from 'vitest'
import { BluetoothChooser, repairPick } from '../src/bluetoothChooser.js'

describe('BluetoothChooser', () => {
  it('merges repeated scan events and answers the latest callback once', () => {
    const chooser = new BluetoothChooser()
    const first: string[] = []
    const second: string[] = []

    expect(chooser.update([{ deviceId: 'b', deviceName: '' }], (id) => first.push(id))).toBe(true)
    expect(
      chooser.update(
        [
          { deviceId: 'b', deviceName: 'HRM-Pro' },
          { deviceId: 'a', deviceName: 'D100' },
          { deviceId: 'c', deviceName: '  ' },
        ],
        (id) => second.push(id),
      ),
    ).toBe(false)

    expect(chooser.devices()).toEqual([
      { id: 'a', name: 'D100' },
      { id: 'b', name: 'HRM-Pro' },
      { id: 'c', name: '' },
    ])
    expect(chooser.choose('a')).toBe(true)
    expect(first).toEqual([])
    expect(second).toEqual(['a'])
    expect(chooser.active).toBe(false)
    expect(chooser.cancel()).toBe(false)
  })

  it('keeps a name it already saw when a later event has none', () => {
    const chooser = new BluetoothChooser()
    chooser.update([{ deviceId: 'a', deviceName: 'D100' }], () => {})
    chooser.update([{ deviceId: 'a', deviceName: '' }], () => {})
    expect(chooser.nameOf('a')).toBe('D100')
  })

  it('picks the single device whose name is the armed re-pair', () => {
    expect(
      repairPick(
        [
          { id: 'a', name: 'VANRYSEL-HT-fc75' },
          { id: 'b', name: '' },
        ],
        'VANRYSEL-HT-fc75',
      ),
    ).toBe('a')
    expect(
      repairPick(
        [
          { id: 'a', name: 'HRM Belt 32306' },
          { id: 'b', name: 'HRM Belt 32306' },
        ],
        'HRM Belt 32306',
      ),
    ).toBeNull()
    expect(repairPick([{ id: 'a', name: 'other' }], '7678-1')).toBeNull()
    expect(repairPick([{ id: 'a', name: '7678-1' }], '  ')).toBeNull()
  })

  it('cancels with an empty device id', () => {
    const chooser = new BluetoothChooser()
    const answers: string[] = []
    chooser.update([], (id) => answers.push(id))
    expect(chooser.choose('unknown')).toBe(false)
    expect(chooser.cancel()).toBe(true)
    expect(answers).toEqual([''])
    expect(chooser.update([], () => {})).toBe(true)
  })
})
