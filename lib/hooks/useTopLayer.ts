import { useEffect, useState } from 'react'

/**
 * Global z-index counter. Every panel/overlay that needs to be "on top"
 * calls useTopLayer() and receives a z-index higher than anything currently open.
 * When the component unmounts the slot is released.
 *
 * Base starts at 100 so it sits above all static z-indexes in the app.
 * Toasts live at z-[1000] and are never affected.
 */
let nextZ = 100

export function useTopLayer(active: boolean) {
  const [zIndex, setZIndex] = useState<number | null>(null)

  useEffect(() => {
    if (active) {
      const z = ++nextZ
      setZIndex(z)
      return () => {
        // If this was the highest, we can reclaim it
        if (nextZ === z) nextZ--
        setZIndex(null)
      }
    } else {
      setZIndex(null)
    }
  }, [active])

  return zIndex
}
