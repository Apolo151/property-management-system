/**
 * Queue configuration for Beds24 sync jobs
 */

export const QUEUE_CONFIG = {
  // Queue names
  QUEUE_NAMES: {
    BEDS24_SYNC: 'beds24-sync',
  },

  // Job priorities
  PRIORITY: {
    HIGH: 10, // Reservations
    MEDIUM: 5, // Availability
    LOW: 3, // Rates
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF: {
      type: 'exponential' as const,
      delay: 5000, // 5 seconds initial delay
    },
  },

  // Job options
  JOB_OPTIONS: {
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
} as const;

