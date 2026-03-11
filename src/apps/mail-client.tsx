import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Folder,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { usePersistentStore } from '@/providers/persistent-store'
import { useApps } from '@/providers/apps'
import { useNotifications } from '@/providers/notifications'
import { useModal } from '@/providers/modal'

type ProviderId = 'gmail' | 'outlook' | 'yahoo' | 'icloud' | 'custom'

type ConnectionConfig = {
  host: string
  port: number
  secure: boolean
}

type MailAccount = {
  id: string
  label: string
  email: string
  password: string
  provider: ProviderId
  imap: ConnectionConfig
  smtp: ConnectionConfig
}

type MailFolder = {
  path: string
  name: string
  specialUse: string | null
}

type MailMessage = {
  uid: number
  messageId: string
  subject: string
  from: string[]
  to: string[]
  date: string | null
  seen: boolean
  flagged: boolean
  hasAttachment: boolean
  preview: string
}

type MailDetail = {
  uid: number
  messageId: string
  subject: string
  from: string[]
  to: string[]
  cc: string[]
  bcc: string[]
  date: string | null
  text: string
  html: string
  seen: boolean
  flagged: boolean
  attachments: Array<{ filename: string; contentType: string; size: number }>
}

type ProviderPreset = {
  id: ProviderId
  label: string
  imap: ConnectionConfig
  smtp: ConnectionConfig
}

type ComposeState = {
  to: string
  cc: string
  bcc: string
  subject: string
  text: string
  html: string
}

type MessageListPayload = {
  messages: MailMessage[]
  total: number
}
type InboxCategory = 'all' | 'primary' | 'social' | 'promotions' | 'updates' | 'forums'
type QuickFilters = {
  unreadOnly: boolean
  attachmentsOnly: boolean
  vipOnly: boolean
}

type InboxDensity = 'compact' | 'comfortable'
type ActionToastTone = 'delete' | 'archive' | 'vip' | 'seen' | 'info'
type ActionToast = {
  message: string
  tone: ActionToastTone
}

type UndoMove = {
  account: MailAccount
  fromFolder: string
  toFolder: string
  uid: number
  messageId: string
}

const EMAIL_API = 'http://localhost:3001/email'
const DETAIL_PREFETCH_COUNT = 8

const DEFAULT_PRESETS: ProviderPreset[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
  },
  {
    id: 'outlook',
    label: 'Outlook / Hotmail',
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
  },
  {
    id: 'yahoo',
    label: 'Yahoo',
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
  },
  {
    id: 'icloud',
    label: 'iCloud',
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
  },
  {
    id: 'custom',
    label: 'Custom domain',
    imap: { host: '', port: 993, secure: true },
    smtp: { host: '', port: 465, secure: true },
  },
]

const emptyCompose = (): ComposeState => ({
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  text: '',
  html: '',
})

const toErrorMessage = (value: unknown) => {
  if (value instanceof Error) return value.message
  return String(value)
}

const emailApiRequest = async <T,>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${EMAIL_API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({ ok: false, error: 'Invalid response' })) as { ok?: boolean; error?: string } & T
  if (!response.ok || payload?.ok === false) {
    throw new Error(String(payload?.error || `HTTP ${response.status}`))
  }
  return payload
}

const providerBadge = (provider: ProviderId) => {
  if (provider === 'gmail') return 'Gmail'
  if (provider === 'outlook') return 'Outlook'
  if (provider === 'yahoo') return 'Yahoo'
  if (provider === 'icloud') return 'iCloud'
  return 'Custom'
}

const detailCacheKey = (folder: string, uid: number) => `${folder}::${uid}`
const listCacheKey = (accountId: string, folder: string, page: number, pageSize: number, query: string) => `${accountId}::${folder}::${page}::${pageSize}::${query.trim().toLowerCase()}`

const senderLabel = (from: string[]) => {
  const raw = from[0] || ''
  if (!raw) return 'Unknown'
  return raw
}

const senderInitial = (from: string[]) => {
  const label = senderLabel(from)
  return label.slice(0, 1).toUpperCase()
}

const folderVisual = (folder: MailFolder) => {
  const name = folder.name.toLowerCase()
  const special = (folder.specialUse || '').toLowerCase()

  if (special.includes('inbox') || name.includes('inbox') || name.includes('posta in arrivo')) {
    return { icon: Inbox, color: 'text-sky-200' }
  }
  if (special.includes('sent') || name.includes('sent') || name.includes('inviata')) {
    return { icon: Send, color: 'text-emerald-200' }
  }
  if (special.includes('trash') || name.includes('trash') || name.includes('cestino')) {
    return { icon: Trash2, color: 'text-rose-200' }
  }
  if (special.includes('archive') || name.includes('archive')) {
    return { icon: Archive, color: 'text-amber-200' }
  }
  if (special.includes('flagged') || special.includes('starred') || name.includes('star')) {
    return { icon: Star, color: 'text-yellow-200' }
  }

  return { icon: Folder, color: 'text-white/80' }
}

const formatMessageTime = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isSameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return date.toLocaleDateString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}

const formatAttachmentSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const CATEGORY_META: Record<InboxCategory, { label: string }> = {
  all: { label: 'All' },
  primary: { label: 'Primary' },
  social: { label: 'Social' },
  promotions: { label: 'Promotions' },
  updates: { label: 'Updates' },
  forums: { label: 'Forums' },
}

const ASSIGNABLE_CATEGORIES: InboxCategory[] = ['primary', 'social', 'promotions', 'updates', 'forums']

const extractSenderAddress = (from: string[]) => {
  const raw = from[0] || ''
  const match = raw.match(/<([^>]+)>/)
  if (match?.[1]) return match[1].trim().toLowerCase()
  if (raw.includes('@')) return raw.trim().toLowerCase()
  return ''
}

const extractSenderDomain = (from: string[]) => {
  const address = extractSenderAddress(from)
  if (!address.includes('@')) return ''
  return address.split('@').pop()?.trim().toLowerCase() || ''
}

const detectInboxCategoryHeuristic = (message: MailMessage): InboxCategory => {
  const from = message.from.join(' ').toLowerCase()
  const subject = (message.subject || '').toLowerCase()
  const preview = (message.preview || '').toLowerCase()
  const text = `${from} ${subject} ${preview}`

  const socialSignals = [
    'facebook', 'instagram', 'linkedin', 'x.com', 'twitter', 'tiktok', 'discord', 'reddit', 'social', 'connection request',
  ]
  if (socialSignals.some((signal) => text.includes(signal))) return 'social'

  const promoSignals = [
    'offerta', 'promo', 'promozione', 'discount', 'sale', 'coupon', 'deal', 'black friday', 'subscribe now', 'limited time',
  ]
  if (promoSignals.some((signal) => text.includes(signal))) return 'promotions'

  const forumSignals = [
    'forum', 'community', 'thread', 'reply', 'digest', 'discussion', 'group', 'newsletter', 'mailing list',
  ]
  if (forumSignals.some((signal) => text.includes(signal))) return 'forums'

  const updateSignals = [
    'receipt', 'fattura', 'invoice', 'ordine', 'order', 'tracking', 'shipment', 'security', 'password', 'verification', 'otp',
    'report', 'alert', 'notification', 'update', 'aggiornamento', 'cambio', 'pagamento',
  ]
  if (updateSignals.some((signal) => text.includes(signal))) return 'updates'

  return 'primary'
}

export const MailClient: React.FC<{ windowId: string }> = () => {
  const { canUsePermission } = useApps()
  const { notify } = useNotifications()
  const { showModal } = useModal()
  const [accounts, setAccounts] = usePersistentStore<MailAccount[]>('mail:accounts', [])
  const [activeAccountId, setActiveAccountId] = usePersistentStore<string | null>('mail:active-account', null)

  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentStore<boolean>('mail:sidebar-collapsed', false)
  const [accountsCollapsed, setAccountsCollapsed] = usePersistentStore<boolean>('mail:accounts-collapsed', false)
  const [foldersCollapsed, setFoldersCollapsed] = usePersistentStore<boolean>('mail:folders-collapsed', false)

  const [presets, setPresets] = useState<ProviderPreset[]>(DEFAULT_PRESETS)
  const [folders, setFolders] = useState<MailFolder[]>([])
  const [selectedFolder, setSelectedFolder] = useState('INBOX')
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<MailDetail | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, MailDetail>>({})
  const [folderCacheByAccount, setFolderCacheByAccount] = useState<Record<string, MailFolder[]>>({})
  const [messageListCache, setMessageListCache] = useState<Record<string, MessageListPayload>>({})

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = usePersistentStore<InboxCategory>('mail:inbox-category', 'all')
  const [inboxDensity, setInboxDensity] = usePersistentStore<InboxDensity>('mail:inbox-density', 'compact')
  const [quickFilters, setQuickFilters] = usePersistentStore<QuickFilters>('mail:quick-filters', {
    unreadOnly: false,
    attachmentsOnly: false,
    vipOnly: false,
  })
  const [vipSenders, setVipSenders] = usePersistentStore<string[]>('mail:vip-senders', [])
  const [categoryRules, setCategoryRules] = usePersistentStore<Record<string, InboxCategory>>('mail:category-rules', {})
  const [page, setPage] = useState(1)
  const [pageSize] = useState(30)
  const [totalMessages, setTotalMessages] = useState(0)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  const [status, setStatus] = useState<'idle' | 'loading' | 'sending' | 'saving-account'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [actionToast, setActionToast] = useState<ActionToast | null>(null)
  const [pendingUndo, setPendingUndo] = useState<UndoMove | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [newAccount, setNewAccount] = useState<MailAccount>({
    id: '',
    label: '',
    email: '',
    password: '',
    provider: 'gmail',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
  })
  const [compose, setCompose] = useState<ComposeState>(emptyCompose())

  const showGmailAppPasswordHint = newAccount.provider === 'gmail'

  const activeAccount = useMemo(() => accounts.find((account) => account.id === activeAccountId) ?? null, [accounts, activeAccountId])
  const isVipMessage = useCallback((message: MailMessage) => {
    const sender = extractSenderAddress(message.from)
    const domain = extractSenderDomain(message.from)
    return vipSenders.includes(sender) || (domain ? vipSenders.includes(`*@${domain}`) : false)
  }, [vipSenders])
  const detectCategory = useCallback((message: MailMessage): InboxCategory => {
    const sender = extractSenderAddress(message.from)
    const domain = extractSenderDomain(message.from)
    if (sender && categoryRules[sender]) return categoryRules[sender]
    const wildcardDomain = domain ? `*@${domain}` : ''
    if (wildcardDomain && categoryRules[wildcardDomain]) return categoryRules[wildcardDomain]
    return detectInboxCategoryHeuristic(message)
  }, [categoryRules])
  const pageCount = Math.max(1, Math.ceil(totalMessages / pageSize))
  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
    [messages],
  )
  const isInboxFolder = useMemo(
    () => selectedFolder.toUpperCase() === 'INBOX' || selectedFolder.toLowerCase().includes('posta in arrivo'),
    [selectedFolder],
  )
  const archiveFolderPath = useMemo(() => {
    const bySpecialUse = folders.find((folder) => String(folder.specialUse || '').toLowerCase().includes('archive'))
    if (bySpecialUse?.path) return bySpecialUse.path
    const byName = folders.find((folder) => {
      const name = folder.name.toLowerCase()
      const path = folder.path.toLowerCase()
      return name.includes('archive') || path.includes('archive') || path.includes('all mail')
    })
    return byName?.path || null
  }, [folders])
  const categoryCounts = useMemo(() => {
    const counts: Record<InboxCategory, number> = {
      all: 0,
      primary: 0,
      social: 0,
      promotions: 0,
      updates: 0,
      forums: 0,
    }

    if (!isInboxFolder) return counts

    for (const message of sortedMessages) {
      counts.all += 1
      counts[detectCategory(message)] += 1
    }

    return counts
  }, [sortedMessages, isInboxFolder, detectCategory])
  const visibleMessages = useMemo(() => {
    const categoryFiltered = isInboxFolder
      ? selectedCategory === 'all'
        ? sortedMessages
        : sortedMessages.filter((message) => detectCategory(message) === selectedCategory)
      : sortedMessages

    return categoryFiltered.filter((message) => {
      if (quickFilters.unreadOnly && message.seen) return false
      if (quickFilters.attachmentsOnly && !message.hasAttachment) return false
      if (quickFilters.vipOnly && !isVipMessage(message)) return false
      return true
    })
  }, [sortedMessages, isInboxFolder, selectedCategory, detectCategory, quickFilters, isVipMessage])
  const unreadCount = useMemo(() => visibleMessages.filter((message) => !message.seen).length, [visibleMessages])
  const networkAllowed = canUsePermission('mail-client', 'network')

  const emailApi = async <T,>(path: string, body: unknown): Promise<T> => {
    if (!networkAllowed) {
      const message = 'Permesso negato: rete disabilitata per Mail.'
      if (canUsePermission('settings', 'notifications')) notify(message, 'warning')
      throw new Error(message)
    }
    return emailApiRequest<T>(path, body)
  }

  const resetFeedback = () => {
    setError(null)
  }

  const showActionToast = useCallback((message: string, tone: ActionToastTone) => {
    setActionToast({ message, tone })
  }, [])

  useEffect(() => {
    if (!actionToast) return
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setActionToast(null)
      setPendingUndo(null)
    }, actionToast.tone === 'delete' || actionToast.tone === 'archive' ? 4800 : 2200)

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [actionToast])

  const dismissActionToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setActionToast(null)
    setPendingUndo(null)
  }

  const refreshCurrentMailboxView = async (targetPage?: number) => {
    if (!activeAccount) return
    const nextPage = targetPage ?? page
    await loadFolders(activeAccount, { force: true })
    await loadMessages(activeAccount, selectedFolder, nextPage, searchQuery, { force: true })
  }

  const preloadDetails = async (account: MailAccount, folder: string, uids: number[]) => {
    const targets = uids
      .slice(0, DETAIL_PREFETCH_COUNT)
      .filter((uid) => !detailCache[detailCacheKey(folder, uid)])

    if (targets.length === 0) return

    await Promise.allSettled(
      targets.map(async (uid) => {
        const payload = await emailApi<{ message: MailDetail }>('/message', { account, folder, uid })
        setDetailCache((prev) => ({
          ...prev,
          [detailCacheKey(folder, uid)]: payload.message,
        }))
      }),
    )
  }

  const loadLazyPreviews = async (account: MailAccount, folder: string, uids: number[]) => {
    if (uids.length === 0) return
    try {
      const payload = await emailApi<{ previews: Record<string, string> }>('/previews', { account, folder, uids })
      setMessages((prev) => prev.map((item) => {
        const nextPreview = payload.previews[String(item.uid)]
        if (typeof nextPreview !== 'string' || !nextPreview.trim()) return item
        return { ...item, preview: nextPreview }
      }))
    } catch {
      // best effort
    }
  }

  const applyMessagePayload = (account: MailAccount, folder: string, payload: MessageListPayload) => {
    setMessages(payload.messages)
    setTotalMessages(payload.total)

    if (payload.messages.length === 0) {
      setSelectedUid(null)
      setSelectedDetail(null)
      return
    }

    if (!payload.messages.some((item) => item.uid === selectedUid)) {
      const firstUid = payload.messages[0].uid
      setSelectedUid(firstUid)
      const cached = detailCache[detailCacheKey(folder, firstUid)]
      setSelectedDetail(cached || null)
      if (!cached) {
        void loadDetail(account, firstUid, folder)
      }
    }
  }

  const loadFolders = async (account: MailAccount, options?: { force?: boolean }) => {
    const force = Boolean(options?.force)
    const cachedFolders = folderCacheByAccount[account.id]

    if (!force && cachedFolders) {
      setFolders(cachedFolders)
      if (!cachedFolders.some((folder) => folder.path === selectedFolder)) {
        const inbox = cachedFolders.find((folder) => folder.path.toUpperCase() === 'INBOX')
        setSelectedFolder(inbox?.path || cachedFolders[0]?.path || 'INBOX')
      }
      return
    }

    const payload = await emailApi<{ folders: MailFolder[] }>('/folders', { account })
    setFolders(payload.folders)
    setFolderCacheByAccount((prev) => ({ ...prev, [account.id]: payload.folders }))
    if (!payload.folders.some((folder) => folder.path === selectedFolder)) {
      const inbox = payload.folders.find((folder) => folder.path.toUpperCase() === 'INBOX')
      setSelectedFolder(inbox?.path || payload.folders[0]?.path || 'INBOX')
    }
  }

  const loadMessages = async (account: MailAccount, folder = selectedFolder, nextPage = page, query = searchQuery, options?: { force?: boolean }) => {
    const force = Boolean(options?.force)
    const cacheKey = listCacheKey(account.id, folder, nextPage, pageSize, query)
    const cachedList = messageListCache[cacheKey]

    if (!force && cachedList) {
      applyMessagePayload(account, folder, cachedList)
      setStatus('idle')
      if (cachedList.messages.length > 0) {
        const uids = cachedList.messages.map((item) => item.uid)
        void preloadDetails(account, folder, uids)
      }
      return
    }

    setStatus('loading')
    const payload = await emailApi<MessageListPayload>('/messages', {
      account,
      folder,
      page: nextPage,
      pageSize,
      query,
    })

    setMessageListCache((prev) => ({ ...prev, [cacheKey]: payload }))
    applyMessagePayload(account, folder, payload)

    setStatus('idle')

    if (payload.messages.length > 0) {
      const uids = payload.messages.map((item) => item.uid)
      void loadLazyPreviews(account, folder, uids)
      void preloadDetails(account, folder, uids)
    }
  }

  const loadDetail = async (account: MailAccount, uid: number, folder = selectedFolder) => {
    const key = detailCacheKey(folder, uid)
    const cached = detailCache[key]

    setSelectedUid(uid)
    if (cached) {
      setSelectedDetail(cached)
      setStatus('idle')
    } else {
      setStatus('loading')
    }

    try {
      const payload = await emailApi<{ message: MailDetail }>('/message', { account, uid, folder })
      setSelectedDetail(payload.message)
      setDetailCache((prev) => ({ ...prev, [key]: payload.message }))
      setStatus('idle')

      if (!payload.message.seen) {
        try {
          await emailApi('/mark', { account, uid, folder, seen: true })
          setMessages((prev) => prev.map((item) => (item.uid === uid ? { ...item, seen: true } : item)))
          setDetailCache((prev) => ({
            ...prev,
            [key]: { ...payload.message, seen: true },
          }))
        } catch {
          // non bloccare la UX
        }
      }
    } catch (detailError) {
      setStatus('idle')
      setError(toErrorMessage(detailError))
    }
  }

  const refreshMailbox = async () => {
    if (!activeAccount) {
      setError('Aggiungi un account email prima di continuare')
      return
    }

    resetFeedback()
    try {
      await loadFolders(activeAccount, { force: true })
      await loadMessages(activeAccount, selectedFolder, page, searchQuery, { force: true })
      showActionToast(`Mailbox aggiornata (${activeAccount.email})`, 'info')
    } catch (fetchError) {
      setError(toErrorMessage(fetchError))
      setStatus('idle')
    }
  }

  useEffect(() => {
    if (activeAccountId && accounts.some((account) => account.id === activeAccountId)) return
    if (accounts.length === 0) {
      setActiveAccountId(null)
      return
    }
    setActiveAccountId(accounts[0].id)
  }, [accounts, activeAccountId, setActiveAccountId])

  useEffect(() => {
    let disposed = false
    const loadProviders = async () => {
      if (!networkAllowed) {
        if (!disposed) setPresets(DEFAULT_PRESETS)
        return
      }
      try {
        const response = await fetch(`${EMAIL_API}/providers`, { method: 'GET' })
        const payload = await response.json().catch(() => ({ ok: false })) as { ok?: boolean; providers?: ProviderPreset[] }
        if (disposed) return
        if (response.ok && payload?.ok && Array.isArray(payload.providers)) {
          const providers = [...payload.providers]
          if (!providers.some((item) => item.id === 'custom')) {
            providers.push(DEFAULT_PRESETS.find((item) => item.id === 'custom')!)
          }
          setPresets(providers)
        }
      } catch {
        if (!disposed) setPresets(DEFAULT_PRESETS)
      }
    }

    void loadProviders()
    return () => {
      disposed = true
    }
  }, [networkAllowed])

  useEffect(() => {
    let disposed = false

    const checkBackend = async () => {
      if (!networkAllowed) {
        if (!disposed) setBackendStatus('offline')
        return
      }

      if (!disposed) {
        setBackendStatus((prev) => (prev === 'online' ? 'online' : 'checking'))
      }

      try {
        const response = await fetch(`${EMAIL_API}/providers`, { method: 'GET' })
        const payload = await response.json().catch(() => ({ ok: false })) as { ok?: boolean }
        if (disposed) return
        setBackendStatus(response.ok && payload?.ok ? 'online' : 'offline')
      } catch {
        if (!disposed) setBackendStatus('offline')
      }
    }

    void checkBackend()
    const timer = setInterval(() => {
      void checkBackend()
    }, 15000)

    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [networkAllowed])

  useEffect(() => {
    if (!activeAccount) return
    if (!networkAllowed) return

    setStatus('loading')
    setMessages([])
    setTotalMessages(0)
    setSelectedUid(null)
    setSelectedDetail(null)
    setPage(1)

    void refreshMailbox()
  }, [activeAccountId, networkAllowed])

  useEffect(() => {
    if (!activeAccount) return
    if (!networkAllowed) return
    void (async () => {
      try {
        await loadMessages(activeAccount, selectedFolder, page, searchQuery)
      } catch (fetchError) {
        setError(toErrorMessage(fetchError))
        setStatus('idle')
      }
    })()
  }, [selectedFolder, page, networkAllowed])

  const onProviderChange = (provider: ProviderId) => {
    const preset = presets.find((item) => item.id === provider) || DEFAULT_PRESETS.find((item) => item.id === provider) || DEFAULT_PRESETS[0]
    setNewAccount((prev) => ({
      ...prev,
      provider,
      imap: { ...preset.imap },
      smtp: { ...preset.smtp },
    }))
  }

  const saveAccount = async () => {
    resetFeedback()
    setStatus('saving-account')

    try {
      if (!newAccount.email.trim() || !newAccount.password.trim()) {
        throw new Error('Email e password sono obbligatori')
      }
      if (!newAccount.label.trim()) {
        throw new Error('Inserisci un nome account')
      }

      const normalizedAccount: MailAccount = {
        ...newAccount,
        password: newAccount.provider === 'gmail' ? newAccount.password.replace(/\s+/g, '') : newAccount.password,
      }

      await emailApi('/test-connection', { account: normalizedAccount })

      const accountToSave: MailAccount = {
        ...normalizedAccount,
        id: crypto.randomUUID(),
        email: normalizedAccount.email.trim(),
        label: normalizedAccount.label.trim(),
      }

      setAccounts((prev) => [...prev, accountToSave])
      setActiveAccountId(accountToSave.id)
      setShowAddAccount(false)
      setNewAccount({
        id: '',
        label: '',
        email: '',
        password: '',
        provider: 'gmail',
        imap: { host: 'imap.gmail.com', port: 993, secure: true },
        smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
      })
      showActionToast(`Account ${accountToSave.email} collegato`, 'info')
    } catch (accountError) {
      setError(toErrorMessage(accountError))
    } finally {
      setStatus('idle')
    }
  }

  const removeAccount = (id: string) => {
    const account = accounts.find((item) => item.id === id)
    if (!account) return

    setAccounts((prev) => prev.filter((item) => item.id !== id))
    if (activeAccountId === id) {
      const fallback = accounts.find((item) => item.id !== id)
      setActiveAccountId(fallback?.id || null)
    }
    showActionToast(`Account ${account.email} rimosso`, 'info')
  }

  const sendMail = async () => {
    if (!activeAccount) {
      setError('Nessun account attivo')
      return
    }

    resetFeedback()
    setStatus('sending')

    try {
      await emailApi('/send', {
        account: activeAccount,
        ...compose,
      })
      setCompose(emptyCompose())
      setShowCompose(false)
      showActionToast('Email inviata con successo', 'info')
      await loadMessages(activeAccount, selectedFolder, 1, searchQuery)
      setPage(1)
    } catch (sendError) {
      setError(toErrorMessage(sendError))
    } finally {
      setStatus('idle')
    }
  }

  const toggleSeen = async (message: MailMessage, seen: boolean) => {
    if (!activeAccount) return

    try {
      await emailApi('/mark', {
        account: activeAccount,
        folder: selectedFolder,
        uid: message.uid,
        seen,
      })
      setMessages((prev) => prev.map((item) => (item.uid === message.uid ? { ...item, seen } : item)))

      const key = detailCacheKey(selectedFolder, message.uid)
      const cached = detailCache[key]
      if (cached) {
        setDetailCache((prev) => ({
          ...prev,
          [key]: { ...cached, seen },
        }))
      }
      if (selectedDetail && selectedDetail.uid === message.uid) {
        setSelectedDetail({ ...selectedDetail, seen })
      }
      showActionToast(seen ? 'Segnata come letta' : 'Segnata come non letta', 'seen')
    } catch (markError) {
      setError(toErrorMessage(markError))
    }
  }

  const deleteMessage = async (message: MailMessage) => {
    if (!activeAccount) return

    try {
      await emailApi('/delete', {
        account: activeAccount,
        folder: selectedFolder,
        uid: message.uid,
        messageId: message.messageId,
      })

      setMessages((prev) => prev.filter((item) => item.uid !== message.uid))
      const key = detailCacheKey(selectedFolder, message.uid)
      setDetailCache((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })

      if (selectedUid === message.uid) {
        setSelectedUid(null)
        setSelectedDetail(null)
      }
      setPendingUndo({
        account: activeAccount,
        fromFolder: selectedFolder,
        toFolder: 'Trash',
        uid: message.uid,
        messageId: message.messageId,
      })
      showActionToast('Messaggio eliminato', 'delete')
    } catch (deleteError) {
      setError(toErrorMessage(deleteError))
    }
  }

  const toggleFlag = async (message: MailMessage, flagged: boolean) => {
    if (!activeAccount) return

    try {
      await emailApi('/flag', {
        account: activeAccount,
        folder: selectedFolder,
        uid: message.uid,
        flagged,
      })

      setMessages((prev) => prev.map((item) => (item.uid === message.uid ? { ...item, flagged } : item)))
      const key = detailCacheKey(selectedFolder, message.uid)
      const cached = detailCache[key]
      if (cached) {
        setDetailCache((prev) => ({
          ...prev,
          [key]: { ...cached, flagged },
        }))
      }
      if (selectedDetail && selectedDetail.uid === message.uid) {
        setSelectedDetail({ ...selectedDetail, flagged })
      }
      showActionToast(flagged ? 'Messaggio contrassegnato' : 'Contrassegno rimosso', 'info')
    } catch (flagError) {
      setError(toErrorMessage(flagError))
    }
  }

  const archiveMessage = async (message: MailMessage) => {
    if (!activeAccount) return

    try {
      const payload = await emailApi<{ archivePath?: string }>('/archive', {
        account: activeAccount,
        folder: selectedFolder,
        uid: message.uid,
      })

      setMessages((prev) => prev.filter((item) => item.uid !== message.uid))
      const key = detailCacheKey(selectedFolder, message.uid)
      setDetailCache((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      if (selectedUid === message.uid) {
        setSelectedUid(null)
        setSelectedDetail(null)
      }
      if (payload.archivePath) {
        setPendingUndo({
          account: activeAccount,
          fromFolder: selectedFolder,
          toFolder: payload.archivePath,
          uid: message.uid,
          messageId: message.messageId,
        })
      } else {
        setPendingUndo(null)
      }
      const target = payload.archivePath ? ` in ${payload.archivePath}` : ''
      showActionToast(`Messaggio archiviato${target}`, 'archive')
    } catch (archiveError) {
      setError(toErrorMessage(archiveError))
    }
  }

  const toggleVipSender = (message: MailMessage) => {
    const sender = extractSenderAddress(message.from)
    if (!sender) return

    setVipSenders((prev) => {
      if (prev.includes(sender)) {
        showActionToast(`Rimosso VIP: ${sender}`, 'vip')
        return prev.filter((item) => item !== sender)
      }
      showActionToast(`Aggiunto VIP: ${sender}`, 'vip')
      return [...prev, sender]
    })
  }

  const learnCategoryFromMessage = (message: MailMessage, category: InboxCategory) => {
    const sender = extractSenderAddress(message.from)
    if (!sender) return

    setCategoryRules((prev) => ({
      ...prev,
      [sender]: category,
    }))
    showActionToast(`Regola salvata: ${sender} → ${CATEGORY_META[category].label}`, 'info')
  }

  const deleteCurrentPage = async () => {
    if (!activeAccount) {
      setError('Nessun account attivo')
      return
    }

    if (visibleMessages.length === 0) {
      showActionToast('Nessun messaggio da eliminare in questa pagina', 'info')
      return
    }

    setStatus('loading')
    const messagesToDelete = [...visibleMessages]

    try {
      const results = await Promise.allSettled(messagesToDelete.map((message) => emailApi('/delete', {
        account: activeAccount,
        folder: selectedFolder,
        uid: message.uid,
        messageId: message.messageId,
      })))

      const successUids = messagesToDelete
        .filter((_, index) => results[index]?.status === 'fulfilled')
        .map((message) => message.uid)

      const failedCount = results.length - successUids.length

      if (successUids.length > 0) {
        const successSet = new Set(successUids)
        setMessages((prev) => prev.filter((item) => !successSet.has(item.uid)))
        setDetailCache((prev) => {
          const next = { ...prev }
          for (const uid of successUids) {
            delete next[detailCacheKey(selectedFolder, uid)]
          }
          return next
        })
        if (selectedUid && successSet.has(selectedUid)) {
          setSelectedUid(null)
          setSelectedDetail(null)
        }
      }

      if (failedCount === 0) {
        showActionToast(`${successUids.length} messaggi eliminati`, 'delete')
        const shouldStepBackPage = page > 1 && successUids.length === messagesToDelete.length
        const nextPage = shouldStepBackPage ? Math.max(1, page - 1) : page
        if (nextPage !== page) setPage(nextPage)
        await refreshCurrentMailboxView(nextPage)
      } else {
        setError(`Eliminati ${successUids.length} messaggi, ${failedCount} non eliminati.`)
        await refreshCurrentMailboxView(page)
      }
    } catch (bulkError) {
      setError(toErrorMessage(bulkError))
    } finally {
      setStatus('idle')
    }
  }

  const confirmDeleteCurrentPage = () => {
    showModal({
      type: 'confirm',
      title: 'Elimina tutti i messaggi di questa pagina?',
      message: `Verranno eliminati ${visibleMessages.length} messaggi della pagina corrente. L'azione non è reversibile.`,
      confirmLabel: 'Elimina tutti',
      cancelLabel: 'Annulla',
      onConfirm: () => {
        void deleteCurrentPage()
      },
    })
  }

  const moveMessageToFolder = async (message: MailMessage, destinationFolder: string) => {
    if (!activeAccount) return
    const target = destinationFolder.trim()
    if (!target || target === selectedFolder) return

    try {
      await emailApi('/move', {
        account: activeAccount,
        fromFolder: selectedFolder,
        toFolder: target,
        uid: message.uid,
        messageId: message.messageId,
      })

      setMessages((prev) => prev.filter((item) => item.uid !== message.uid))
      const key = detailCacheKey(selectedFolder, message.uid)
      setDetailCache((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      if (selectedUid === message.uid) {
        setSelectedUid(null)
        setSelectedDetail(null)
      }
      showActionToast(`Messaggio spostato in ${target}`, 'info')
    } catch (moveError) {
      setError(toErrorMessage(moveError))
    }
  }

  const promptMoveMessage = (message: MailMessage) => {
    const fallback = folders.find((folder) => folder.path !== selectedFolder)?.path || ''
    showModal({
      type: 'confirm',
      title: 'Sposta messaggio',
      message: 'Inserisci la cartella di destinazione',
      defaultValue: fallback,
      confirmLabel: 'Sposta',
      cancelLabel: 'Annulla',
      onConfirm: (value?: string) => {
        const destination = String(value || '').trim()
        if (!destination) return
        void moveMessageToFolder(message, destination)
      },
    })
  }

  const createFolderPrompt = () => {
    if (!activeAccount) {
      setError('Nessun account attivo')
      return
    }

    showModal({
      type: 'confirm',
      title: 'Crea cartella',
      message: 'Inserisci il nome/percorso della nuova cartella',
      defaultValue: 'NuovaCartella',
      confirmLabel: 'Crea',
      cancelLabel: 'Annulla',
      onConfirm: async (value?: string) => {
        const path = String(value || '').trim()
        if (!path) return
        try {
          await emailApi('/folder/create', { account: activeAccount, path })
          await refreshCurrentMailboxView(page)
          setSelectedFolder(path)
          showActionToast(`Cartella creata: ${path}`, 'info')
        } catch (folderError) {
          setError(toErrorMessage(folderError))
        }
      },
    })
  }

  const renameFolderPrompt = () => {
    if (!activeAccount) {
      setError('Nessun account attivo')
      return
    }
    if (selectedFolder.toUpperCase() === 'INBOX') {
      setError('INBOX non può essere rinominata')
      return
    }

    showModal({
      type: 'confirm',
      title: 'Rinomina cartella',
      message: `Nuovo nome per ${selectedFolder}`,
      defaultValue: selectedFolder,
      confirmLabel: 'Rinomina',
      cancelLabel: 'Annulla',
      onConfirm: async (value?: string) => {
        const newPath = String(value || '').trim()
        if (!newPath || newPath === selectedFolder) return
        try {
          await emailApi('/folder/rename', { account: activeAccount, path: selectedFolder, newPath })
          setSelectedFolder(newPath)
          await refreshCurrentMailboxView(page)
          showActionToast(`Cartella rinominata in ${newPath}`, 'info')
        } catch (folderError) {
          setError(toErrorMessage(folderError))
        }
      },
    })
  }

  const deleteFolderPrompt = () => {
    if (!activeAccount) {
      setError('Nessun account attivo')
      return
    }
    if (selectedFolder.toUpperCase() === 'INBOX') {
      setError('INBOX non può essere eliminata')
      return
    }

    showModal({
      type: 'confirm',
      title: `Eliminare la cartella ${selectedFolder}?`,
      message: 'L’operazione potrebbe essere irreversibile in base al provider.',
      confirmLabel: 'Elimina cartella',
      cancelLabel: 'Annulla',
      onConfirm: async () => {
        try {
          await emailApi('/folder/delete', { account: activeAccount, path: selectedFolder })
          setSelectedFolder('INBOX')
          setPage(1)
          await refreshCurrentMailboxView(1)
          showActionToast('Cartella eliminata', 'delete')
        } catch (folderError) {
          setError(toErrorMessage(folderError))
        }
      },
    })
  }

  const openArchiveFolder = async () => {
    if (!activeAccount) {
      setError('Nessun account attivo')
      return
    }

    try {
      const path = archiveFolderPath || 'Archive'
      if (!archiveFolderPath) {
        await emailApi('/folder/create', { account: activeAccount, path })
        await loadFolders(activeAccount, { force: true })
      }
      setSelectedFolder(path)
      setPage(1)
      await loadMessages(activeAccount, path, 1, searchQuery, { force: true })
      showActionToast(`Aperta cartella archivio: ${path}`, 'archive')
    } catch (archiveError) {
      setError(toErrorMessage(archiveError))
    }
  }

  const undoLastMove = async () => {
    if (!pendingUndo) return

    try {
      await emailApi('/move', {
        account: pendingUndo.account,
        fromFolder: pendingUndo.toFolder,
        toFolder: pendingUndo.fromFolder,
        uid: pendingUndo.uid,
        messageId: pendingUndo.messageId,
      })
      setPendingUndo(null)
      showActionToast('Operazione annullata', 'info')
      await refreshCurrentMailboxView(page)
    } catch (undoError) {
      setError(toErrorMessage(undoError))
    }
  }

  const sidebarWidthClass = sidebarCollapsed ? 'w-[106px]' : 'w-[320px]'

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden bg-white/5 border border-white/15 backdrop-blur-2xl text-white flex">
      <aside className={`${sidebarWidthClass} transition-all duration-200 border-r border-white/10 bg-white/[0.04] p-3 flex flex-col gap-3`}>
        <div className={`rounded-xl border border-white/15 bg-white/5 ${sidebarCollapsed ? 'px-2 py-2.5' : 'px-3 py-2'} flex items-center justify-between`}>
          <div className={`flex items-center min-w-0 ${sidebarCollapsed ? 'justify-center w-full' : 'gap-2'}`}>
            <Mail className="h-4 w-4 text-white/90" />
            {!sidebarCollapsed ? <p className="text-sm font-semibold truncate">Inbox</p> : null}
          </div>
          <div className={`flex items-center ${sidebarCollapsed ? 'gap-1.5 mt-2 justify-center w-full' : 'gap-1'}`}>
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-white/20 bg-white/10 hover:bg-white/15"
              title={sidebarCollapsed ? 'Espandi menu' : 'Collassa menu'}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <button
              onClick={() => {
                resetFeedback()
                setShowAddAccount(true)
              }}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-white/20 bg-white/10 hover:bg-white/15"
              title="Aggiungi account"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!sidebarCollapsed ? (
          <button
            onClick={() => setAccountsCollapsed((prev) => !prev)}
            className="w-full flex items-center justify-between text-[11px] uppercase tracking-widest text-white/55 px-1"
          >
            <span>Account</span>
            {accountsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        ) : null}

        <div className={`${sidebarCollapsed ? 'max-h-[40%]' : 'max-h-[33%]'} overflow-auto custom-scroll space-y-2 pr-1`}>
          {accountsCollapsed && !sidebarCollapsed ? null : accounts.length === 0 ? (
            <p className="text-xs text-white/60">Nessun account collegato</p>
          ) : (
            accounts.map((account) => {
              const active = account.id === activeAccountId
              return (
                <div
                  key={account.id}
                  className={`rounded-xl border ${sidebarCollapsed ? 'px-2 py-2' : 'px-2.5 py-2'} ${active ? 'border-white/35 bg-white/15' : 'border-white/15 bg-white/[0.03] hover:bg-white/[0.08]'}`}
                >
                  <button onClick={() => setActiveAccountId(account.id)} className={`w-full ${sidebarCollapsed ? 'text-center' : 'text-left'}`} title={`${account.label} • ${account.email}`}>
                    {!sidebarCollapsed ? (
                      <>
                        <p className="text-sm font-medium truncate">{account.label}</p>
                        <p className="text-xs text-white/65 truncate mt-0.5">{account.email}</p>
                        <p className="text-[10px] uppercase tracking-wide text-white/45 mt-1">{providerBadge(account.provider)}</p>
                      </>
                    ) : (
                      <div className="space-y-1">
                        <div className={`h-9 w-9 mx-auto rounded-full border inline-flex items-center justify-center text-xs font-semibold ${active ? 'border-white/45 bg-white/20 text-white' : 'border-white/25 bg-white/10 text-white/85'}`}>
                          {account.label.slice(0, 1).toUpperCase()}
                        </div>
                        <p className="text-[10px] text-white/70 truncate">{account.label.slice(0, 6)}</p>
                      </div>
                    )}
                  </button>
                  {!sidebarCollapsed ? (
                    <button onClick={() => removeAccount(account.id)} className="mt-2 text-[11px] text-rose-200 hover:text-rose-100">
                      Rimuovi
                    </button>
                  ) : null}
                </div>
              )
            })
          )}
        </div>

        <div className="rounded-xl border border-white/15 bg-white/[0.03] p-2.5 flex-1 min-h-0 flex flex-col gap-2">
          <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-1.5' : 'gap-2'}`}>
            <button
              onClick={() => {
                setCompose(emptyCompose())
                setShowCompose(true)
              }}
              disabled={!activeAccount}
              className={`${sidebarCollapsed ? 'w-full' : 'flex-1'} h-9 rounded-lg bg-white/20 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium`}
            >
              {sidebarCollapsed ? <Send className="h-4 w-4 mx-auto" /> : 'Nuova Email'}
            </button>
            <button
              onClick={() => void refreshMailbox()}
              disabled={!activeAccount || status === 'loading'}
              className={`${sidebarCollapsed ? 'w-full' : 'h-9 w-9'} h-9 inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 disabled:opacity-40`}
            >
              <RefreshCw className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {!sidebarCollapsed ? (
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/45" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setPage(1)
                    void refreshMailbox()
                  }
                }}
                placeholder="Cerca"
                className="w-full h-9 rounded-lg pl-8 pr-2 border border-white/20 bg-white/5 text-sm outline-none focus:border-white/40"
              />
            </div>
          ) : null}

          {!sidebarCollapsed ? (
            <div className="w-full flex items-center justify-between text-[11px] uppercase tracking-widest text-white/55 px-1 gap-1">
              <button
                onClick={() => setFoldersCollapsed((prev) => !prev)}
                className="inline-flex items-center gap-1"
              >
                <span>Cartelle</span>
                {foldersCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              <div className="inline-flex items-center gap-1 normal-case tracking-normal">
                <button onClick={() => void openArchiveFolder()} className="h-6 px-1.5 rounded-md border border-amber-300/35 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25 text-[10px]">Archivio</button>
                <button onClick={createFolderPrompt} className="h-6 px-1.5 rounded-md border border-white/20 bg-white/10 hover:bg-white/15 text-[10px]">New</button>
                <button onClick={renameFolderPrompt} className="h-6 px-1.5 rounded-md border border-white/20 bg-white/10 hover:bg-white/15 text-[10px]">Ren</button>
                <button onClick={deleteFolderPrompt} className="h-6 px-1.5 rounded-md border border-rose-300/30 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25 text-[10px]">Del</button>
              </div>
            </div>
          ) : null}

          <div className="min-h-0 overflow-auto custom-scroll space-y-1 pr-1">
            {foldersCollapsed && !sidebarCollapsed ? null : folders.map((folder) => {
              const active = selectedFolder === folder.path
              const folderStyle = folderVisual(folder)
              const FolderIcon = folderStyle.icon
              return (
                <button
                  key={folder.path}
                  onClick={() => {
                    setSelectedFolder(folder.path)
                    setPage(1)
                  }}
                  title={folder.name}
                  className={`w-full ${sidebarCollapsed ? 'text-center px-2 py-2 min-h-[56px]' : 'text-left px-2.5 py-2'} rounded-lg text-sm border ${active ? 'bg-white/20 border-white/30' : 'bg-white/[0.03] border-transparent hover:bg-white/[0.08]'}`}
                >
                  {sidebarCollapsed ? (
                    <div className="w-full flex flex-col items-center gap-1">
                      <span className={`h-7 w-7 rounded-md border inline-flex items-center justify-center ${active ? 'border-white/40 bg-white/15 text-white' : 'border-white/20 bg-white/5'} ${folderStyle.color}`}>
                        <FolderIcon className="h-4 w-4" />
                      </span>
                      <span className="block w-full max-w-[64px] text-[10px] text-white/70 leading-none truncate">{folder.name}</span>
                    </div>
                  ) : folder.name}
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      <section className="flex-1 min-w-0 flex bg-white/[0.03]">
        <div className="relative w-[42%] min-w-[370px] border-r border-white/10 flex flex-col bg-white/[0.02]">
          <div className="px-4 border-b border-white/10 bg-white/[0.03]">
            <div className="h-14 flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold tracking-tight leading-none">{selectedFolder}</p>
                <p className="text-[11px] text-white/55 mt-1">{totalMessages} messaggi</p>
              </div>
              <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInboxDensity((prev) => prev === 'compact' ? 'comfortable' : 'compact')}
                    className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] text-white/85 hover:bg-white/15"
                    title="Cambia densità lista"
                  >
                    {inboxDensity === 'compact' ? 'Comfortable' : 'Compact'}
                  </button>
                  <button
                    onClick={confirmDeleteCurrentPage}
                    disabled={visibleMessages.length === 0 || status === 'loading'}
                    className="rounded-full border border-rose-300/35 bg-rose-500/20 px-2.5 py-1 text-[10px] text-rose-100 hover:bg-rose-500/30 disabled:opacity-40"
                    title="Elimina tutti i messaggi della pagina"
                  >
                    Delete all
                  </button>
                <span className={`rounded-full border px-2 py-1 text-[10px] ${backendStatus === 'online' ? 'border-emerald-300/35 bg-emerald-500/20 text-emerald-100' : backendStatus === 'checking' ? 'border-amber-300/30 bg-amber-500/20 text-amber-100' : 'border-rose-300/35 bg-rose-500/20 text-rose-100'}`}>
                  Mail API: {backendStatus === 'online' ? 'Online' : backendStatus === 'checking' ? 'Checking' : 'Offline'}
                </span>
                <div className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] text-white/80">
                  {unreadCount} non letti
                </div>
              </div>
            </div>

            {isInboxFolder ? (
              <div className="pb-2.5 space-y-2">
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll">
                {(Object.keys(CATEGORY_META) as InboxCategory[]).map((category) => {
                  const active = selectedCategory === category
                  const count = categoryCounts[category]
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] border transition ${active ? 'border-white/35 bg-white/18 text-white' : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.1]'}`}
                    >
                      <span>{CATEGORY_META[category].label}</span>
                      <span className={`inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full ${active ? 'bg-white/20 text-white/95' : 'bg-white/10 text-white/60'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll">
                  <button
                    onClick={() => setQuickFilters((prev) => ({ ...prev, unreadOnly: !prev.unreadOnly }))}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border transition ${quickFilters.unreadOnly ? 'border-sky-300/45 bg-sky-500/20 text-sky-100' : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.1]'}`}
                  >
                    Non lette
                  </button>
                  <button
                    onClick={() => setQuickFilters((prev) => ({ ...prev, attachmentsOnly: !prev.attachmentsOnly }))}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border transition ${quickFilters.attachmentsOnly ? 'border-violet-300/45 bg-violet-500/20 text-violet-100' : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.1]'}`}
                  >
                    Con allegati
                  </button>
                  <button
                    onClick={() => setQuickFilters((prev) => ({ ...prev, vipOnly: !prev.vipOnly }))}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border transition ${quickFilters.vipOnly ? 'border-amber-300/45 bg-amber-500/20 text-amber-100' : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.1]'}`}
                  >
                    Da VIP
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="px-2.5 pt-2">
              <div className="rounded-lg border px-3 py-2 text-xs flex items-start justify-between gap-2 border-rose-300/40 bg-rose-500/20 text-rose-100">
                <div className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  onClick={resetFeedback}
                  className="h-5 w-5 inline-flex items-center justify-center rounded-md hover:bg-black/20"
                  aria-label="Chiudi messaggio"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="min-h-0 overflow-auto custom-scroll p-2 space-y-1.5">
            {status === 'loading' && visibleMessages.length === 0 ? (
              <div className="space-y-1.5">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`skeleton-${index}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 backdrop-blur-xl animate-pulse">
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-full border border-white/20 bg-white/10 shrink-0" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="h-3 w-28 rounded bg-white/15" />
                          <div className="h-2.5 w-12 rounded bg-white/10" />
                        </div>
                        <div className="h-3.5 w-4/5 rounded bg-white/20" />
                        <div className="h-2.5 w-full rounded bg-white/10" />
                        <div className="h-2.5 w-2/3 rounded bg-white/10" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : visibleMessages.length === 0 ? (
              <p className="text-sm text-white/55 p-4">Nessun messaggio in questa vista</p>
            ) : (
              visibleMessages.map((message) => {
                const active = selectedUid === message.uid
                const category = detectCategory(message)
                const isVip = isVipMessage(message)
                const isComfortable = inboxDensity === 'comfortable'
                return (
                  <div
                    key={message.uid}
                    className={`group rounded-xl border ${isComfortable ? 'px-3 py-2.5' : 'px-2.5 py-2'} cursor-pointer transition ${active ? 'border-white/35 bg-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.22)]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'} backdrop-blur-xl`}
                    onClick={() => {
                      if (!activeAccount) return
                      void loadDetail(activeAccount, message.uid)
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`${isComfortable ? 'h-8 w-8 text-xs' : 'h-7 w-7 text-[11px]'} rounded-full border inline-flex items-center justify-center font-semibold shrink-0 ${active ? 'border-white/35 bg-white/20 text-white' : 'border-white/25 bg-white/10 text-white/90'}`}>
                        {senderInitial(message.from)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className={`${isComfortable ? 'text-xs' : 'text-[11px]'} truncate ${message.seen ? 'text-white/70' : 'text-white font-semibold'}`}>{senderLabel(message.from)}</p>
                            {isVip ? <Star className="h-3 w-3 text-amber-200 shrink-0" /> : null}
                            {isInboxFolder ? (
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border border-white/15 bg-white/[0.06] text-white/60">
                                {CATEGORY_META[category].label}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[10px] text-white/45 shrink-0">{formatMessageTime(message.date)}</span>
                        </div>
                        <p className={`${isComfortable ? 'text-sm' : 'text-[13px]'} truncate mt-0.5 ${message.seen ? 'font-medium text-white/90' : 'font-semibold text-white'}`}>{message.subject || '(senza oggetto)'}</p>
                        <p className={`${isComfortable ? 'text-xs line-clamp-2' : 'text-[11px] line-clamp-1'} text-white/55 mt-0.5 leading-relaxed`}>{message.preview || '(messaggio vuoto)'}</p>
                        <div className={`${isComfortable ? 'mt-2' : 'mt-1.5'} flex items-center justify-between`}>
                          <div className="flex items-center gap-1.5 text-[10px] text-white/45">
                            {message.hasAttachment ? <Paperclip className="h-3 w-3" /> : null}
                            {message.flagged ? <Star className="h-3 w-3 text-amber-200" /> : null}
                            {!message.seen ? <span className="inline-block h-2 w-2 rounded-full bg-sky-300" /> : null}
                          </div>
                          <div className={`flex items-center gap-1.5 text-[10px] transition ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                void toggleSeen(message, !message.seen)
                              }}
                              className="px-2 py-1 rounded-md border border-white/15 bg-white/8 hover:bg-white/15"
                            >
                              {message.seen ? 'Non letto' : 'Letto'}
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                toggleVipSender(message)
                              }}
                              className={`px-2 py-1 rounded-md border inline-flex items-center gap-1 ${isVip ? 'border-amber-300/35 bg-amber-500/20 text-amber-100' : 'border-white/15 bg-white/8 hover:bg-white/15'}`}
                            >
                              <Star className="h-3 w-3" /> VIP
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                void toggleFlag(message, !message.flagged)
                              }}
                              className={`px-2 py-1 rounded-md border ${message.flagged ? 'border-amber-300/35 bg-amber-500/20 text-amber-100' : 'border-white/15 bg-white/8 hover:bg-white/15'}`}
                            >
                              {message.flagged ? 'Unflag' : 'Flag'}
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                void archiveMessage(message)
                              }}
                              className="px-2 py-1 rounded-md border border-amber-300/35 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30 inline-flex items-center gap-1"
                            >
                              <Archive className="h-3 w-3" /> Arch
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                promptMoveMessage(message)
                              }}
                              className="px-2 py-1 rounded-md border border-cyan-300/30 bg-cyan-500/18 text-cyan-100 hover:bg-cyan-500/28 inline-flex items-center gap-1"
                            >
                              Move
                            </button>
                            <select
                              value={category}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                event.stopPropagation()
                                learnCategoryFromMessage(message, event.target.value as InboxCategory)
                              }}
                              className="px-2 py-1 rounded-md border border-white/15 bg-white/8 text-white text-[10px]"
                              title="Impara categoria da questo mittente"
                            >
                              {ASSIGNABLE_CATEGORIES.map((option) => (
                                <option key={option} value={option} className="bg-slate-900">
                                  {CATEGORY_META[option].label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                void deleteMessage(message)
                              }}
                              className="px-2 py-1 rounded-md border border-rose-300/35 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30 inline-flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" /> Del
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="h-10 border-t border-white/10 px-3 flex items-center justify-between text-xs rounded-xl">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="px-2 py-1 rounded-md border border-white/15 bg-white/8 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-white/60">Pagina {page} / {pageCount}</span>
            <button
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              disabled={page >= pageCount}
              className="px-2 py-1 rounded-md border border-white/15 bg-white/8 disabled:opacity-40"
            >
              Next
            </button>
          </div>

          {actionToast ? (
            <div className="absolute bottom-14 right-3 z-20">
              <div
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] inline-flex items-center gap-1.5 shadow-lg backdrop-blur-xl ${
                  actionToast.tone === 'delete'
                    ? 'border-rose-300/45 bg-rose-500/25 text-rose-100'
                    : actionToast.tone === 'archive'
                      ? 'border-amber-300/45 bg-amber-500/25 text-amber-100'
                      : actionToast.tone === 'vip'
                        ? 'border-yellow-300/45 bg-yellow-500/25 text-yellow-100'
                        : actionToast.tone === 'seen'
                          ? 'border-sky-300/45 bg-sky-500/25 text-sky-100'
                          : 'border-emerald-300/40 bg-emerald-500/22 text-emerald-100'
                }`}
              >
                {actionToast.tone === 'delete' ? <Trash2 className="h-3.5 w-3.5" /> : null}
                {actionToast.tone === 'archive' ? <Archive className="h-3.5 w-3.5" /> : null}
                {actionToast.tone === 'vip' ? <Star className="h-3.5 w-3.5" /> : null}
                {actionToast.tone === 'seen' ? <MailOpen className="h-3.5 w-3.5" /> : null}
                {actionToast.tone === 'info' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                <span>{actionToast.message}</span>
                {(actionToast.tone === 'delete' || actionToast.tone === 'archive') && pendingUndo ? (
                  <button onClick={() => void undoLastMove()} className="ml-1 px-1.5 py-0.5 rounded bg-black/20 hover:bg-black/30 text-[10px]">
                    Undo
                  </button>
                ) : null}
                <button onClick={dismissActionToast} className="ml-1 opacity-80 hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex-1 min-w-0 flex flex-col bg-white/[0.02]">
          <div className="h-12 border-b border-white/10 px-4 flex items-center gap-2">
            {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin text-white/80" /> : null}
            <p className="text-sm text-white/85 truncate">{selectedDetail?.subject || 'Seleziona un messaggio'}</p>
          </div>

          <div className="min-h-0 h-full rounded-xl overflow-hidden p-4">
            {selectedDetail ? (
              <div className="h-full flex flex-col gap-3 rounded-xl min-h-0">
                <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm">
                    <p><span className="text-white/55">Da:</span> {selectedDetail.from.join(', ') || '-'}</p>
                    <p><span className="text-white/55">A:</span> {selectedDetail.to.join(', ') || '-'}</p>
                    {selectedDetail.cc.length > 0 ? <p><span className="text-white/55">CC:</span> {selectedDetail.cc.join(', ')}</p> : null}
                    <p><span className="text-white/55">Data:</span> {selectedDetail.date ? new Date(selectedDetail.date).toLocaleString() : '-'}</p>

                    <div className="mt-2.5 border-t border-white/10 pt-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-white/85">Allegati</p>
                        <span className="text-[11px] text-white/55">{selectedDetail.attachments.length}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedDetail.attachments.length === 0 ? (
                          <p className="text-[11px] text-white/55 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5">
                            Nessun allegato
                          </p>
                        ) : (
                          selectedDetail.attachments.map((attachment, index) => (
                            <div key={`${attachment.filename}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 max-w-[280px]">
                              <p className="text-[11px] text-white/90 truncate" title={attachment.filename}>{attachment.filename || 'file'}</p>
                              <p className="text-[10px] text-white/55 mt-0.5">{formatAttachmentSize(attachment.size || 0)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 custom-scroll overflow-auto pr-1">
                  {selectedDetail.html ? (
                    <iframe
                      title="email-html"
                      sandbox="allow-same-origin"
                      srcDoc={selectedDetail.html}
                      className="w-full h-full min-h-0 rounded-xl border border-white/15"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap rounded-xl border border-white/15 bg-black/20 p-4 text-sm text-white/90 h-full min-h-0 overflow-auto">
                      {selectedDetail.text || '(nessun contenuto testuale)'}
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-white/55 text-sm">
                Nessun messaggio selezionato
              </div>
            )}
          </div>
        </div>
      </section>

      {(showAddAccount || showCompose) ? (
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-30 p-5">
          {showAddAccount ? (
            <div className="w-[660px] max-w-full rounded-2xl border border-white/20 bg-[#0d1528]/95 backdrop-blur-xl p-5 space-y-3">
              <h3 className="text-lg font-semibold">Aggiungi account email</h3>
              <p className="text-xs text-white/60">Provider popolari e domini custom (es. @gh3sp.com) con IMAP/SMTP.</p>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-white/75">
                  Nome account
                  <input value={newAccount.label} onChange={(event) => setNewAccount((prev) => ({ ...prev, label: event.target.value }))} className="mt-1 h-9 w-full rounded-md border border-white/20 bg-white/5 px-2 text-sm" />
                </label>
                <label className="text-xs text-white/75">
                  Provider
                  <select value={newAccount.provider} onChange={(event) => onProviderChange(event.target.value as ProviderId)} className="mt-1 h-9 w-full rounded-md border border-white/20 bg-white/5 px-2 text-sm">
                    {presets.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                  </select>
                </label>
                <label className="text-xs text-white/75">
                  Email
                  <input value={newAccount.email} onChange={(event) => setNewAccount((prev) => ({ ...prev, email: event.target.value }))} className="mt-1 h-9 w-full rounded-md border border-white/20 bg-white/5 px-2 text-sm" />
                </label>
                <label className="text-xs text-white/75">
                  Password / App Password
                  <input type="password" value={newAccount.password} onChange={(event) => setNewAccount((prev) => ({ ...prev, password: event.target.value }))} className="mt-1 h-9 w-full rounded-md border border-white/20 bg-white/5 px-2 text-sm" />
                </label>
              </div>

              {showGmailAppPasswordHint ? (
                <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-3 text-xs text-amber-100">
                  <p className="font-medium">Gmail richiede App Password</p>
                  <ol className="mt-1 list-decimal pl-4 space-y-0.5 text-amber-50/95">
                    <li>Attiva la verifica in 2 passaggi sul tuo account Google</li>
                    <li>Crea una App Password nelle impostazioni sicurezza</li>
                    <li>Incolla quella password qui (non la password principale Google)</li>
                  </ol>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 border border-white/10 rounded-xl p-3 bg-black/15">
                <div className="space-y-2">
                  <p className="text-xs text-white/60 uppercase">IMAP</p>
                  <input value={newAccount.imap.host} onChange={(event) => setNewAccount((prev) => ({ ...prev, imap: { ...prev.imap, host: event.target.value } }))} placeholder="host" className="h-8 w-full rounded-md border border-white/20 bg-white/5 px-2 text-sm" />
                  <input value={String(newAccount.imap.port)} onChange={(event) => setNewAccount((prev) => ({ ...prev, imap: { ...prev.imap, port: Number(event.target.value) || 993 } }))} placeholder="port" className="h-8 w-full rounded-md border border-white/20 bg-white/5 px-2 text-sm" />
                  <label className="text-xs inline-flex items-center gap-2"><input type="checkbox" checked={newAccount.imap.secure} onChange={(event) => setNewAccount((prev) => ({ ...prev, imap: { ...prev.imap, secure: event.target.checked } }))} /> SSL/TLS</label>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-white/60 uppercase">SMTP</p>
                  <input value={newAccount.smtp.host} onChange={(event) => setNewAccount((prev) => ({ ...prev, smtp: { ...prev.smtp, host: event.target.value } }))} placeholder="host" className="h-8 w-full rounded-md border border-white/20 bg-white/5 px-2 text-sm" />
                  <input value={String(newAccount.smtp.port)} onChange={(event) => setNewAccount((prev) => ({ ...prev, smtp: { ...prev.smtp, port: Number(event.target.value) || 465 } }))} placeholder="port" className="h-8 w-full rounded-md border border-white/20 bg-white/5 px-2 text-sm" />
                  <label className="text-xs inline-flex items-center gap-2"><input type="checkbox" checked={newAccount.smtp.secure} onChange={(event) => setNewAccount((prev) => ({ ...prev, smtp: { ...prev.smtp, secure: event.target.checked } }))} /> SSL/TLS</label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[11px] text-white/50">Le credenziali sono salvate localmente nel browser per uso desktop.</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAddAccount(false)} className="px-3 h-9 rounded-md bg-white/10">Annulla</button>
                  <button onClick={() => void saveAccount()} className="px-4 h-9 rounded-md bg-white/25 hover:bg-white/30 inline-flex items-center gap-2">
                    {status === 'saving-account' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Connetti
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-[760px] max-w-full rounded-2xl border border-white/20 bg-[#0d1528]/95 backdrop-blur-xl p-5 space-y-3">
              <h3 className="text-lg font-semibold">Nuova email</h3>
              <div className="grid grid-cols-1 gap-2">
                <input value={compose.to} onChange={(event) => setCompose((prev) => ({ ...prev, to: event.target.value }))} placeholder="To" className="h-9 rounded-md border border-white/20 bg-white/5 px-2 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={compose.cc} onChange={(event) => setCompose((prev) => ({ ...prev, cc: event.target.value }))} placeholder="CC" className="h-9 rounded-md border border-white/20 bg-white/5 px-2 text-sm" />
                  <input value={compose.bcc} onChange={(event) => setCompose((prev) => ({ ...prev, bcc: event.target.value }))} placeholder="BCC" className="h-9 rounded-md border border-white/20 bg-white/5 px-2 text-sm" />
                </div>
                <input value={compose.subject} onChange={(event) => setCompose((prev) => ({ ...prev, subject: event.target.value }))} placeholder="Oggetto" className="h-9 rounded-md border border-white/20 bg-white/5 px-2 text-sm" />
                <textarea value={compose.text} onChange={(event) => setCompose((prev) => ({ ...prev, text: event.target.value }))} placeholder="Testo email" className="h-44 rounded-md border border-white/20 bg-white/5 px-2 py-2 text-sm" />
                <textarea value={compose.html} onChange={(event) => setCompose((prev) => ({ ...prev, html: event.target.value }))} placeholder="HTML opzionale" className="h-28 rounded-md border border-white/20 bg-white/5 px-2 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCompose(false)} className="px-3 h-9 rounded-md bg-white/10">Annulla</button>
                <button onClick={() => void sendMail()} className="px-4 h-9 rounded-md bg-white/25 hover:bg-white/30 inline-flex items-center gap-2">
                  {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Invia
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

    </div>
  )
}
