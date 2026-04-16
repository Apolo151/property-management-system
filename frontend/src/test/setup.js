import '@testing-library/jest-dom';

// Mock fetch globally for all tests
globalThis.fetch = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  fetch.mockReset();
});

// Suppress noisy console.error in tests (optional, remove if you want full output)
// const originalError = console.error;
// beforeAll(() => {
//   console.error = (...args) => {
//     if (typeof args[0] === 'string' && args[0].includes('Warning:')) return;
//     originalError(...args);
//   };
// });
// afterAll(() => { console.error = originalError; });
