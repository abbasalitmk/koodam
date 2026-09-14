import { validateSingleDaySchedule } from '../src/modules/events/events.service';
import { computeGhostPoint, haversineMeters } from '../src/common/utils/geo.util';
import { calculateAge } from '../src/common/utils/date.util';

describe('Koodam Core Domain Logic Unit Tests', () => {
  describe('Strict Single-Day Schedule Validation', () => {
    it('allows valid single-day event within 8 hours', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const dateStr = futureDate.toISOString().slice(0, 10);

      expect(() => {
        validateSingleDaySchedule(dateStr, '16:00', '20:00');
      }).not.toThrow();
    });

    it('rejects events longer than 8 hours (480 minutes)', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const dateStr = futureDate.toISOString().slice(0, 10);

      expect(() => {
        validateSingleDaySchedule(dateStr, '09:00', '18:00'); // 9 hours
      }).toThrow('Koodam gatherings are limited to a single calendar day (max 8 hours).');
    });

    it('rejects end time that occurs before start time', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const dateStr = futureDate.toISOString().slice(0, 10);

      expect(() => {
        validateSingleDaySchedule(dateStr, '19:00', '17:00');
      }).toThrow('End time must be after start time on the same day.');
    });

    it('rejects events scheduled in the past', () => {
      expect(() => {
        validateSingleDaySchedule('2020-01-01', '10:00', '12:00');
      }).toThrow('Cannot create an event in the past.');
    });
  });

  describe('Ghost Centroid Privacy Obfuscation', () => {
    it('blurs coordinates between 400m and 900m to protect privacy', () => {
      const real = { latitude: 9.9312, longitude: 76.2673 }; // Kochi
      const ghost = computeGhostPoint(real, 400, 900);

      const distanceMeters = haversineMeters(real, ghost);

      expect(distanceMeters).toBeGreaterThanOrEqual(390); // allow slight floating point rounding
      expect(distanceMeters).toBeLessThanOrEqual(910);
      expect(ghost.latitude).not.toEqual(real.latitude);
      expect(ghost.longitude).not.toEqual(real.longitude);
    });
  });

  describe('Age Calculation from Date of Birth', () => {
    it('calculates age correctly without exposing exact birthdate', () => {
      const now = new Date();
      const dob = new Date(now.getFullYear() - 25, now.getMonth(), now.getDate() - 1);
      expect(calculateAge(dob)).toBe(25);
    });
  });
});
