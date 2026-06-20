import { useEffect, useRef } from 'react'

/**
 * Hidden SVG that defines the liquid-glass displacement filter referenced by
 * `.glass-refract` in CSS (backdrop-filter: url('#liquid-glass-filter')).
 *
 * Apple's "liquid glass" look = blurred backdrop + a displacement map driven by
 * fractal turbulence, so content beneath the glass bends/refracts at the edges.
 * We slowly animate the turbulence seed for a gentle "flowing" feel.
 */
export function LiquidGlassFilter() {
  const turbRef = useRef<SVGFETurbulenceElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const reduce = document.documentElement.classList.contains('reduce-motion')
    if (reduce) return

    let seed = 0
    let last = performance.now()
    const tick = (now: number) => {
      // Advance very slowly (~ every 90ms) to keep it subtle + cheap.
      if (now - last > 90) {
        last = now
        seed = (seed + 1) % 100
        turbRef.current?.setAttribute('seed', String(seed))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      style={{ position: 'absolute', pointerEvents: 'none' }}
    >
      <defs>
        <filter
          id="liquid-glass-filter"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          {/* Fractal noise as the displacement source */}
          <feTurbulence
            ref={turbRef}
            type="fractalNoise"
            baseFrequency="0.008 0.012"
            numOctaves={2}
            seed={2}
            result="noise"
          />
          {/* Soften the noise so refraction is smooth, not grainy */}
          <feGaussianBlur in="noise" stdDeviation="2" result="softNoise" />
          {/* Bend the backdrop using the noise — this is the "liquid" bit */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="16"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}
