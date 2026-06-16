import { describe, it, expect } from 'vitest';
import { compareInstancesBySlice, type InstanceInfo } from '../useDicomSeriesInstances';

const makeInstance = (overrides: Partial<InstanceInfo>): InstanceInfo => ({
  instanceId: overrides.instanceId ?? 'sop',
  frames: 1,
  ...overrides,
});

const sortIds = (instances: InstanceInfo[]) =>
  [...instances].sort(compareInstancesBySlice).map((i) => i.instanceId);

describe('compareInstancesBySlice', () => {
  it('sorts primarily by ImagePositionPatient z-coordinate', () => {
    const instances = [
      makeInstance({ instanceId: 'c', imagePosition: [0, 0, 30], instanceNumber: 1 }),
      makeInstance({ instanceId: 'a', imagePosition: [0, 0, 10], instanceNumber: 2 }),
      makeInstance({ instanceId: 'b', imagePosition: [0, 0, 20], instanceNumber: 3 }),
    ];
    // z-coordinate wins over (here intentionally inverse) InstanceNumber
    expect(sortIds(instances)).toEqual(['a', 'b', 'c']);
  });

  it('falls back to SliceLocation when z-coordinate is unavailable', () => {
    const instances = [
      makeInstance({ instanceId: 'c', sliceLocation: 3, instanceNumber: 1 }),
      makeInstance({ instanceId: 'a', sliceLocation: 1, instanceNumber: 2 }),
      makeInstance({ instanceId: 'b', sliceLocation: 2, instanceNumber: 3 }),
    ];
    expect(sortIds(instances)).toEqual(['a', 'b', 'c']);
  });

  it('falls back to InstanceNumber when no spatial metadata exists', () => {
    const instances = [
      makeInstance({ instanceId: 'c', instanceNumber: 3 }),
      makeInstance({ instanceId: 'a', instanceNumber: 1 }),
      makeInstance({ instanceId: 'b', instanceNumber: 2 }),
    ];
    expect(sortIds(instances)).toEqual(['a', 'b', 'c']);
  });

  it('uses SliceLocation as tiebreaker when z-coordinates are equal', () => {
    const instances = [
      makeInstance({ instanceId: 'b', imagePosition: [0, 0, 10], sliceLocation: 2 }),
      makeInstance({ instanceId: 'a', imagePosition: [0, 0, 10], sliceLocation: 1 }),
    ];
    expect(sortIds(instances)).toEqual(['a', 'b']);
  });

  it('treats missing InstanceNumber as 0 in the fallback path', () => {
    const instances = [
      makeInstance({ instanceId: 'b', instanceNumber: 1 }),
      makeInstance({ instanceId: 'a' }),
    ];
    expect(sortIds(instances)).toEqual(['a', 'b']);
  });
});
