import { forwardRef, HTMLAttributes } from 'react'

interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  /** apply the SVG refraction layer (heavier; great for big panels) */
  refract?: boolean
  /** apply the specular sheen highlight */
  sheen?: boolean
}

/**
 * A frosted "liquid glass" surface. Composes the .glass CSS classes.
 * Use refract for hero surfaces (composer, top bar, popovers) and skip it on
 * tiny elements to keep the GPU happy.
 */
export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass(
  { refract = false, sheen = true, className = '', children, ...rest },
  ref,
) {
  const classes = [
    'glass',
    refract ? 'glass-refract' : '',
    sheen ? 'glass-sheen' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={ref} className={classes} {...rest}>
      {children}
    </div>
  )
})
