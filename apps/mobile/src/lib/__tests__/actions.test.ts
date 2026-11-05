import { fmtTime, openStatus } from '../actions';

describe('hours helpers', () => {
  it('formats 24h times for display', () => {
    expect(fmtTime('09:00')).toBe('9 AM');
    expect(fmtTime('13:30')).toBe('1:30 PM');
    expect(fmtTime('00:00')).toBe('12 AM');
  });
  it('reports open/closed from stored hours using local time', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-04T12:00:00')); // Wednesday noon local
    expect(openStatus({ wed: [{ open: '09:00', close: '21:00' }] })).toEqual({ open: true, label: 'Open · closes 9 PM' });
    expect(openStatus({ wed: [{ open: '17:00', close: '22:00' }] })).toEqual({ open: false, label: 'Closed · opens 5 PM' });
    expect(openStatus({ wed: [] })).toEqual({ open: false, label: 'Closed today' });
    expect(openStatus({})).toEqual({ open: null, label: 'Hours not listed' });
    jest.useRealTimers();
  });
});
