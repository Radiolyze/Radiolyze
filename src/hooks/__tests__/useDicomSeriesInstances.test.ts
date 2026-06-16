import { describe, it, expect } from 'vitest';
import {
  compareInstancesBySlice,
  getInstanceInfo,
  type InstanceInfo,
} from '../useDicomSeriesInstances';

const make = (overrides: Partial<InstanceInfo>): InstanceInfo => ({
  instanceId: 'x',
  frames: 1,
  ...overrides,
});

describe('compareInstancesBySlice', () => {
  it('sorts primarily by ImagePositionPatient z-coordinate', () => {
    const items = [
      make({ instanceId: 'a', imagePosition: [0, 0, 30], instanceNumber: 1 }),
      make({ instanceId: 'b', imagePosition: [0, 0, 10], instanceNumber: 2 }),
      make({ instanceId: 'c', imagePosition: [0, 0, 20], instanceNumber: 3 }),
    ];
    items.sort(compareInstancesBySlice);
    expect(items.map((i) => i.instanceId)).toEqual(['b', 'c', 'a']);
  });

  it('falls back to SliceLocation when z is unavailable', () => {
    const items = [
      make({ instanceId: 'a', sliceLocation: 5, instanceNumber: 1 }),
      make({ instanceId: 'b', sliceLocation: -5, instanceNumber: 2 }),
      make({ instanceId: 'c', sliceLocation: 0, instanceNumber: 3 }),
    ];
    items.sort(compareInstancesBySlice);
    expect(items.map((i) => i.instanceId)).toEqual(['b', 'c', 'a']);
  });

  it('falls back to InstanceNumber when neither z nor SliceLocation are present', () => {
    const items = [
      make({ instanceId: 'a', instanceNumber: 3 }),
      make({ instanceId: 'b', instanceNumber: 1 }),
      make({ instanceId: 'c', instanceNumber: 2 }),
    ];
    items.sort(compareInstancesBySlice);
    expect(items.map((i) => i.instanceId)).toEqual(['b', 'c', 'a']);
  });

  it('breaks z-ties using the next available criterion', () => {
    const items = [
      make({ instanceId: 'a', imagePosition: [0, 0, 10], instanceNumber: 2 }),
      make({ instanceId: 'b', imagePosition: [0, 0, 10], instanceNumber: 1 }),
    ];
    items.sort(compareInstancesBySlice);
    expect(items.map((i) => i.instanceId)).toEqual(['b', 'a']);
  });
});

describe('getInstanceInfo', () => {
  it('reads SliceLocation (tag 00201041)', () => {
    const info = getInstanceInfo({
      '00080018': { Value: ['1.2.3'] },
      '00201041': { Value: [12.5] },
    });
    expect(info?.instanceId).toBe('1.2.3');
    expect(info?.sliceLocation).toBe(12.5);
  });

  it('reads the z-coordinate from ImagePositionPatient (tag 00200032)', () => {
    const info = getInstanceInfo({
      '00080018': { Value: ['1.2.3'] },
      '00200032': { Value: [-100, -100, 42] },
    });
    expect(info?.imagePosition).toEqual([-100, -100, 42]);
  });

  it('handles a plain instance-id string', () => {
    const info = getInstanceInfo('plain-id');
    expect(info).toEqual({ instanceId: 'plain-id', frames: 1 });
  });
});
