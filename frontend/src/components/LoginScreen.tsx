import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'
import { Glass } from './Glass'
import { Avatar } from './Avatar'
import { api, events, SavedAccount } from '../services/discord'
import { User } from '../types'
import { useChatStore } from '../store/chatStore'
import { IconClose } from './icons'

interface Props {
  onMockMode: () => void
}

type Step = 'accounts' | 'qr' | 'token'

export function LoginScreen({ onMockMode }: Props) {
  const goLive = useChatStore((s) => s.goLive)

  const [step, setStep] = useState<Step>('accounts')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [token, setToken] = useState('')
  const [accounts, setAccounts] = useState<SavedAccount[]>([])

  // QR state
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrUser, setQrUser] = useState<{
    username: string
    avatarUrl: string
  } | null>(null)
  const qrCleanup = useRef<(() => void)[]>([])

  useEffect(() => {
    api
      .listAccounts()
      .then((accts) => {
        setAccounts(accts)
        if (accts.length === 0) setStep('qr')
      })
      .catch(() => setStep('qr'))
  }, [])

  const enterSession = async (user: User) => {
    const servers = await api.getServers()
    await goLive(user, servers)
  }

  // ---- QR login ----
  const stopQR = () => {
    qrCleanup.current.forEach((fn) => fn())
    qrCleanup.current = []
    api.cancelQRLogin().catch(() => {})
    setQrDataUrl('')
    setQrUser(null)
  }

  const startQR = () => {
    setError('')
    setQrDataUrl('')
    setQrUser(null)
    setStep('qr')

    const offCode = events.onQRCode(async (url) => {
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 220,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        })
        setQrDataUrl(dataUrl)
      } catch {
        /* ignore */
      }
    })
    const offUser = events.onQRUser((u) =>
      setQrUser({ username: u.username, avatarUrl: u.avatarUrl }),
    )
    const offSuccess = events.onQRSuccess(async (user) => {
      stopQR()
      await enterSession(user)
    })
    const offErr = events.onQRError((e) => {
      setError(e || 'QR login failed.')
      setQrDataUrl('')
    })
    qrCleanup.current = [offCode, offUser, offSuccess, offErr]
    api.startQRLogin().catch((e) => setError(String(e)))
  }

  // Start the QR flow automatically when entering the QR step fresh.
  useEffect(() => {
    if (step === 'qr' && !qrDataUrl && qrCleanup.current.length === 0) {
      startQR()
    }
    return () => {
      // Clean up listeners when leaving the QR step.
      if (step !== 'qr') stopQR()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ---- token login ----
  const submitToken = async () => {
    const t = token.trim()
    if (!t) return
    setLoading(true)
    setError('')
    try {
      const res = await api.login(t)
      if (!res.ok || !res.user) {
        setError(res.error || 'Login failed. Check the token.')
        setLoading(false)
        return
      }
      await enterSession(res.user)
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  const switchTo = async (id: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.switchAccount(id)
      if (!res.ok || !res.user) {
        setError(res.error || 'Failed to log in to that account.')
        setLoading(false)
        return
      }
      await enterSession(res.user)
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  const removeAccount = async (id: string) => {
    await api.removeAccount(id)
    const accts = await api.listAccounts()
    setAccounts(accts)
    if (accts.length === 0) setStep('qr')
  }

  const inputClass =
    'no-drag selectable w-full rounded-xl bg-crust/60 px-4 py-3 text-sm text-text outline-none ring-1 ring-white/5 transition focus:ring-accent placeholder:text-muted'

  return (
    <div className="relative flex h-screen w-screen items-center justify-center">
      <div className="app-wallpaper animated" />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-[420px] max-w-[92vw]"
      >
        <Glass refract className="rounded-3xl p-8">
          <h1 className="mb-1 text-2xl font-extrabold text-text">Frostcord</h1>
          <p className="mb-6 text-sm text-subtext">
            A liquid-glass, Telegram-style Discord client.
          </p>

          {error && (
            <div
              className="mb-3 rounded-xl px-3 py-2 text-sm"
              style={{
                background: 'rgb(var(--c-danger) / 0.15)',
                color: 'rgb(var(--c-danger))',
              }}
            >
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ---- Saved accounts ---- */}
            {step === 'accounts' && (
              <StepWrap key="accounts">
                <Label>Switch account</Label>
                <div className="mb-3 flex flex-col gap-2">
                  {accounts.map((a) => (
                    <div
                      key={a.id}
                      className="group flex items-center gap-3 rounded-xl bg-crust/50 p-2 transition hover:bg-surface1/50"
                    >
                      <button
                        onClick={() => switchTo(a.id)}
                        disabled={loading}
                        className="no-drag flex flex-1 items-center gap-3 text-left"
                      >
                        <Avatar
                          user={{
                            id: a.id,
                            username: a.username,
                            displayName: a.globalName || a.username,
                            avatarUrl: a.avatarUrl || undefined,
                          }}
                          size={36}
                        />
                        <div className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate text-sm font-bold text-text">
                            {a.globalName || a.username}
                          </span>
                          <span className="truncate text-xs text-muted">
                            @{a.username}
                          </span>
                        </div>
                      </button>
                      <button
                        onClick={() => removeAccount(a.id)}
                        className="no-drag flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition hover:bg-surface2 hover:text-danger group-hover:opacity-100"
                        title="Remove account"
                      >
                        <IconClose width={14} height={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <AccentButton onClick={startQR}>+ Add an account</AccentButton>
              </StepWrap>
            )}

            {/* ---- QR login ---- */}
            {step === 'qr' && (
              <StepWrap key="qr">
                <Label>Log in with QR code</Label>
                <p className="mb-3 text-xs text-muted">
                  Open Discord on your phone, go to Settings → scan QR code, and
                  point it here.
                </p>
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="flex h-[220px] w-[220px] items-center justify-center overflow-hidden rounded-2xl bg-white"
                    style={{ boxShadow: '0 8px 24px rgb(0 0 0 / 0.25)' }}
                  >
                    {qrUser ? (
                      <div className="flex flex-col items-center gap-2 text-center">
                        <Avatar
                          user={{
                            id: 'qr',
                            username: qrUser.username,
                            displayName: qrUser.username,
                            avatarUrl: qrUser.avatarUrl || undefined,
                          }}
                          size={72}
                        />
                        <span className="px-3 text-sm font-bold text-black">
                          {qrUser.username}
                        </span>
                        <span className="text-xs text-neutral-500">
                          Confirm on your phone
                        </span>
                      </div>
                    ) : qrDataUrl ? (
                      <img src={qrDataUrl} alt="QR code" className="h-full w-full" />
                    ) : (
                      <span className="text-sm text-neutral-400">
                        Generating QR…
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <GhostButton onClick={() => setStep('token')}>
                    Log in with token instead
                  </GhostButton>
                  {accounts.length > 0 && (
                    <GhostButton onClick={() => setStep('accounts')}>
                      Back to accounts
                    </GhostButton>
                  )}
                </div>
              </StepWrap>
            )}

            {/* ---- Token login ---- */}
            {step === 'token' && (
              <StepWrap key="token">
                <Label>User token</Label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitToken()}
                  placeholder="Paste your Discord token"
                  className={`${inputClass} mb-4`}
                />
                <AccentButton
                  onClick={submitToken}
                  disabled={loading || !token.trim()}
                >
                  {loading ? 'Connecting…' : 'Log in'}
                </AccentButton>
                <GhostButton onClick={() => setStep('qr')}>
                  Log in with QR code instead
                </GhostButton>
              </StepWrap>
            )}
          </AnimatePresence>

          <button
            onClick={onMockMode}
            className="no-drag mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-subtext transition hover:bg-surface1 hover:text-text"
          >
            Preview UI with demo data
          </button>

          <p className="mt-5 text-center text-[0.7rem] leading-relaxed text-muted">
            Third-party clients violate Discord's ToS and may risk your account.
            Use at your own risk.
          </p>
        </Glass>
      </motion.div>
    </div>
  )
}

function StepWrap({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
      {children}
    </label>
  )
}

function AccentButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="no-drag mb-2 w-full rounded-xl py-3 text-sm font-bold transition disabled:opacity-50"
      style={{
        background: 'rgb(var(--c-accent))',
        color: 'rgb(var(--c-bubble-mine-text))',
      }}
    >
      {children}
    </button>
  )
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="no-drag w-full rounded-xl py-2 text-sm font-semibold text-subtext transition hover:bg-surface1 hover:text-text"
    >
      {children}
    </button>
  )
}
