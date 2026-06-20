import { AnimatePresence, motion } from 'framer-motion'
import { Glass } from './Glass'
import { IconClose } from './icons'
import { useThemeStore } from '../theme/themeStore'

export function SettingsPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const {
    theme,
    available,
    glass,
    reduceMotion,
    animatedWallpaper,
    customInput,
    setTheme,
    setGlass,
    setReduceMotion,
    setAnimatedWallpaper,
    setCustomInput,
    applyCustom,
  } = useThemeStore()

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-50 w-[560px] max-w-[92vw]"
          >
            <Glass refract className="max-h-[82vh] overflow-hidden rounded-3xl">
              {/* Header */}
              <div className="flex items-center border-b border-white/5 px-6 py-4">
                <h2 className="text-lg font-extrabold text-text">Appearance</h2>
                <button
                  onClick={onClose}
                  className="no-drag ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface1 hover:text-text"
                >
                  <IconClose width={18} height={18} />
                </button>
              </div>

              <div className="scroll-thin max-h-[64vh] overflow-y-auto px-6 py-5">
                {/* Theme presets */}
                <Section title="Theme">
                  <div className="grid grid-cols-2 gap-3">
                    {available.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className="no-drag flex items-center gap-3 rounded-xl p-3 text-left transition"
                        style={{
                          background: `rgb(${t.colors.base})`,
                          border:
                            theme.id === t.id
                              ? `2px solid rgb(${t.colors.accent})`
                              : '2px solid transparent',
                          outline:
                            theme.id === t.id
                              ? '2px solid rgb(var(--c-accent) / 0.3)'
                              : 'none',
                        }}
                      >
                        <div className="flex gap-1">
                          <Swatch color={t.colors.accent} />
                          <Swatch color={t.colors.bubbleMine} />
                          <Swatch color={t.colors.surface0} />
                        </div>
                        <span
                          className="text-sm font-bold"
                          style={{ color: `rgb(${t.colors.text})` }}
                        >
                          {t.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Custom theme builder */}
                <Section title="Custom theme">
                  <div className="grid grid-cols-2 gap-3">
                    <ColorField
                      label="Background"
                      value={customInput.base}
                      onChange={(v) => setCustomInput({ base: v })}
                    />
                    <ColorField
                      label="Accent"
                      value={customInput.accent}
                      onChange={(v) => setCustomInput({ accent: v })}
                    />
                    <ColorField
                      label="Accent 2"
                      value={customInput.accent2}
                      onChange={(v) => setCustomInput({ accent2: v })}
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-subtext">Mode</span>
                      <div className="flex gap-1 rounded-xl bg-crust/50 p-1">
                        {(['dark', 'light'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setCustomInput({ mode: m })}
                            className="no-drag flex-1 rounded-lg px-2 py-1 text-sm font-semibold capitalize transition"
                            style={{
                              background:
                                customInput.mode === m
                                  ? 'rgb(var(--c-accent) / 0.3)'
                                  : 'transparent',
                              color:
                                customInput.mode === m
                                  ? 'rgb(var(--c-text))'
                                  : 'rgb(var(--c-muted))',
                            }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={applyCustom}
                    className="no-drag mt-3 w-full rounded-xl py-2 text-sm font-bold transition"
                    style={{
                      background: 'rgb(var(--c-accent))',
                      color: 'rgb(var(--c-bubble-mine-text))',
                    }}
                  >
                    Apply custom theme
                  </button>
                </Section>

                {/* Glass tuning */}
                <Section title="Liquid glass">
                  <Slider
                    label="Blur"
                    min={0}
                    max={40}
                    step={1}
                    value={glass.blur}
                    suffix="px"
                    onChange={(v) => setGlass({ blur: v })}
                  />
                  <Slider
                    label="Opacity"
                    min={0}
                    max={1}
                    step={0.05}
                    value={glass.opacity}
                    onChange={(v) => setGlass({ opacity: v })}
                  />
                  <Slider
                    label="Refraction"
                    min={0}
                    max={1}
                    step={0.05}
                    value={glass.refraction}
                    onChange={(v) => setGlass({ refraction: v })}
                  />
                </Section>

                {/* Motion */}
                <Section title="Motion">
                  <Toggle
                    label="Animated wallpaper"
                    checked={animatedWallpaper}
                    onChange={setAnimatedWallpaper}
                  />
                  <Toggle
                    label="Reduce motion"
                    checked={reduceMotion}
                    onChange={setReduceMotion}
                  />
                </Section>
              </div>
            </Glass>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="h-5 w-5 rounded-full"
      style={{ background: `rgb(${color})`, border: '1px solid rgb(255 255 255 / 0.15)' }}
    />
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-subtext">{label}</span>
      <div className="flex items-center gap-2 rounded-xl bg-crust/50 px-2 py-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="no-drag h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="no-drag selectable w-full bg-transparent font-mono text-sm text-text outline-none"
        />
      </div>
    </label>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  suffix,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-semibold text-subtext">{label}</span>
        <span className="text-muted">
          {step < 1 ? value.toFixed(2) : value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="no-drag w-full accent-[rgb(var(--c-accent))]"
      />
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="mb-2 flex cursor-pointer items-center justify-between">
      <span className="text-sm font-semibold text-subtext">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className="no-drag relative h-6 w-11 rounded-full transition"
        style={{
          background: checked ? 'rgb(var(--c-accent))' : 'rgb(var(--c-surface2))',
        }}
      >
        <motion.span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white"
          animate={{ left: checked ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </label>
  )
}
