import { useEffect, useRef } from 'react'

/**
 * @param {() => void | Promise<void>} callback
 * @param {number} intervalMs
 * @param {boolean} [enabled=true]
 */
export function usePolling(callback, intervalMs, enabled = true) {
  const savedCallback = useRef(callback)
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) return undefined
    const id = setInterval(() => {
      const fn = savedCallback.current
      if (fn) void fn()
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
}

export default usePolling
