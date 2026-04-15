const resetFns = new Set();

export function registerDomainReset(fn) {
  resetFns.add(fn);
}

export function resetAllDomainStores() {
  resetFns.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Domain store reset failed', e);
    }
  });
}
