import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import bodyParser from 'body-parser'
import { promisify } from 'util'
import { execFile, spawn } from 'child_process'
import drivelist from 'drivelist'
import mime from 'mime-types';
import WebSocket, { WebSocketServer } from "ws";
import { Client } from "ssh2";

const app = express()
const PORT = 3001
const execFileAsync = promisify(execFile)
const IS_WINDOWS = process.platform === 'win32'
const SELENIUM_BASE_URL = 'http://localhost:4444/wd/hub'
const DEFAULT_SECURE_BROWSER_URL = 'https://www.google.com'
let secureBrowserSessionId = null

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const RUNTIME_APPS = [
  { id: 'notepad', endpoint: 'http://localhost:4101' },
  { id: 'file-explorer', endpoint: 'http://localhost:4102' },
  { id: 'terminal', endpoint: 'http://localhost:4103' },
  { id: 'browser', endpoint: 'http://localhost:4104' },
]

const getServiceName = (appId) => `app-${appId}`

const withTimeout = async (promise, timeoutMs) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await promise(controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}

const checkEndpoint = async (url) => {
  try {
    const response = await withTimeout(
      (signal) => fetch(url, { method: 'GET', cache: 'no-store', signal }),
      1800,
    )
    return response.ok
  } catch {
    return false
  }
}

const dockerComposeExec = async (args = []) => {
  const result = await execFileAsync('docker', ['compose', '-f', 'docker-compose.apps.yml', ...args], {
    cwd: process.cwd(),
    windowsHide: true,
  })
  return `${result.stdout || ''}${result.stderr || ''}`.trim()
}

const secureBrowserComposeExec = async (args = []) => {
  const result = await execFileAsync('docker', ['compose', '-f', 'docker-compose.secure-browser.yml', ...args], {
    cwd: process.cwd(),
    windowsHide: true,
  })
  return `${result.stdout || ''}${result.stderr || ''}`.trim()
}

const dockerInfoExec = async () => {
  await execFileAsync('docker', ['info'], {
    cwd: process.cwd(),
    windowsHide: true,
  })
}

const isDockerEngineUnavailableError = (error) => {
  const raw = String(error?.message || error || '').toLowerCase()
  return (
    raw.includes('dockerdesktoplinuxengine') ||
    raw.includes('system cannot find the file specified') ||
    raw.includes('is the docker daemon running') ||
    raw.includes('cannot connect to the docker daemon')
  )
}

const startDockerDesktopWindows = () => {
  const candidates = [
    'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
    'C:\\Program Files (x86)\\Docker\\Docker\\Docker Desktop.exe',
  ]

  const executable = candidates.find((candidate) => fs.existsSync(candidate))
  if (!executable) return false

  const child = spawn(executable, [], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
  return true
}

const tryAutoStartDockerDesktop = async (error) => {
  if (!IS_WINDOWS || !isDockerEngineUnavailableError(error)) {
    return { attempted: false, ready: false, message: '' }
  }

  const started = startDockerDesktopWindows()
  if (!started) {
    return {
      attempted: true,
      ready: false,
      message: 'Docker Desktop non trovato nel percorso standard.',
    }
  }

  const timeoutMs = 90000
  const intervalMs = 2000
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await dockerInfoExec()
      return {
        attempted: true,
        ready: true,
        message: 'Docker Desktop avviato e daemon pronto.',
      }
    } catch {
      await sleep(intervalMs)
    }
  }

  return {
    attempted: true,
    ready: false,
    message: 'Docker Desktop avviato ma daemon non pronto entro 90 secondi.',
  }
}

const runCompose = async (args = []) => {
  try {
    return await dockerComposeExec(args)
  } catch (error) {
    const recovery = await tryAutoStartDockerDesktop(error)
    if (recovery.ready) {
      return await dockerComposeExec(args)
    }
    if (recovery.attempted) {
      throw new Error(`${String(error?.message || error)}\n${recovery.message}`)
    }
    throw error
  }
}

const mapRuntimeCommandError = (error) => {
  const raw = String(error?.message || error || '')
  const lower = raw.toLowerCase()

  if (lower.includes('dockerdesktoplinuxengine') || lower.includes('system cannot find the file specified')) {
    return {
      message: 'Docker Desktop non è avviato (engine Linux non disponibile). Avvia Docker Desktop e attendi stato "Engine running", poi riprova apps:up.',
      raw,
      code: 'DOCKER_ENGINE_UNAVAILABLE',
    }
  }

  if (lower.includes('is the docker daemon running') || lower.includes('cannot connect to the docker daemon')) {
    return {
      message: 'Docker daemon non raggiungibile. Verifica che Docker Desktop sia aperto e funzionante.',
      raw,
      code: 'DOCKER_DAEMON_UNREACHABLE',
    }
  }

  if (lower.includes('docker') && lower.includes('not recognized')) {
    return {
      message: 'Docker CLI non trovata nel PATH. Installa Docker Desktop o correggi il PATH.',
      raw,
      code: 'DOCKER_CLI_NOT_FOUND',
    }
  }

  return {
    message: raw,
    raw,
    code: 'RUNTIME_COMMAND_FAILED',
  }
}

const runtimeAppExists = (appId) => RUNTIME_APPS.some((appItem) => appItem.id === appId)

const parseJsonSafely = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const seleniumFetch = async (url, options = {}, timeoutMs = 45000) => {
  return withTimeout((signal) => fetch(url, { ...options, signal }), timeoutMs)
}

const createSeleniumSession = async () => {
  const uniqueProfileDir = `/tmp/gh3spos-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const response = await seleniumFetch(`${SELENIUM_BASE_URL}/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      capabilities: {
        alwaysMatch: {
          browserName: 'chrome',
          'goog:chromeOptions': {
            args: ['--no-first-run', '--no-default-browser-check', `--user-data-dir=${uniqueProfileDir}`],
          },
        },
      },
    }),
  }, 70000)

  const payload = await parseJsonSafely(response)
  const sessionId = payload?.value?.sessionId || payload?.sessionId || null

  if (!response.ok || !sessionId) {
    throw new Error(payload?.value?.message || `Unable to create Selenium session (status ${response.status})`)
  }

  return sessionId
}

const getExistingSeleniumSessionId = async () => {
  const response = await seleniumFetch(`${SELENIUM_BASE_URL}/sessions`, {
    method: 'GET',
    headers: { 'content-type': 'application/json' },
  }, 10000)

  if (!response.ok) return null
  const payload = await parseJsonSafely(response)
  const sessions = Array.isArray(payload?.value) ? payload.value : []
  const first = sessions[0]
  if (!first || typeof first !== 'object') return null
  return first.id || first.sessionId || null
}

const navigateSeleniumSession = async (sessionId, targetUrl) => {
  const response = await seleniumFetch(`${SELENIUM_BASE_URL}/session/${encodeURIComponent(sessionId)}/url`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: targetUrl }),
  }, 50000)

  const payload = await parseJsonSafely(response)
  if (!response.ok) {
    const message = payload?.value?.message || `Unable to navigate Selenium session (status ${response.status})`
    const err = new Error(message)
    err.code = payload?.value?.error || 'SELENIUM_NAVIGATION_FAILED'
    throw err
  }
}

const runSeleniumSessionCommand = async (sessionId, command, body = undefined, method = 'POST') => {
  const normalizedMethod = String(method || 'POST').toUpperCase()
  const resolvedBody = normalizedMethod === 'GET'
    ? undefined
    : JSON.stringify(body === undefined ? {} : body)

  const response = await seleniumFetch(`${SELENIUM_BASE_URL}/session/${encodeURIComponent(sessionId)}/${command}`, {
    method: normalizedMethod,
    headers: { 'content-type': 'application/json' },
    body: resolvedBody,
  }, 50000)

  const payload = await parseJsonSafely(response)
  if (!response.ok) {
    const message = payload?.value?.message || `Unable to execute Selenium command "${command}" (status ${response.status})`
    const err = new Error(message)
    err.code = payload?.value?.error || 'SELENIUM_COMMAND_FAILED'
    throw err
  }

  return payload?.value
}

const getCurrentSeleniumUrl = async (sessionId) => {
  const value = await runSeleniumSessionCommand(sessionId, 'url', undefined, 'GET')
  return typeof value === 'string' && value.trim() ? value : DEFAULT_SECURE_BROWSER_URL
}

const isInvalidSeleniumSessionError = (error) => {
  const raw = String(error?.message || error || '').toLowerCase()
  return raw.includes('invalid session id') || raw.includes('no such session')
}

const ensureSecureBrowserSession = async () => {
  const waitForSeleniumReady = async (timeoutMs = 35000) => {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      try {
        const response = await seleniumFetch(`${SELENIUM_BASE_URL}/status`, { method: 'GET' }, 8000)
        const payload = await parseJsonSafely(response)
        if (response.ok && payload?.value?.ready) return true
      } catch {
        // noop
      }
      await sleep(1500)
    }
    return false
  }

  const run = async () => {
    if (!secureBrowserSessionId) {
      secureBrowserSessionId = await getExistingSeleniumSessionId() || await createSeleniumSession()
    }
    return secureBrowserSessionId
  }

  try {
    return await run()
  } catch (error) {
    const raw = String(error?.message || error || '').toLowerCase()
    const isSessionBootstrapIssue =
      raw.includes('session not created') ||
      raw.includes('user data directory is already in use') ||
      raw.includes('this operation was aborted') ||
      raw.includes('aborterror') ||
      raw.includes('timed out')

    if (isSessionBootstrapIssue) {
      try {
        await secureBrowserComposeExec(['restart', 'secure-browser'])
        const ready = await waitForSeleniumReady()
        if (!ready) throw new Error('Secure browser non pronto dopo il riavvio.')
        secureBrowserSessionId = null
        return await run()
      } catch (restartError) {
        throw new Error(String(restartError?.message || restartError || error))
      }
    }

    if (!isInvalidSeleniumSessionError(error)) throw error
    secureBrowserSessionId = await getExistingSeleniumSessionId() || await createSeleniumSession()
    return secureBrowserSessionId
  }
}

const runSecureBrowserAction = async (action) => {
  let sessionId = await ensureSecureBrowserSession()
  try {
    return await action(sessionId)
  } catch (error) {
    if (!isInvalidSeleniumSessionError(error)) throw error
    secureBrowserSessionId = null
    sessionId = await ensureSecureBrowserSession()
    return await action(sessionId)
  }
}

const ensureSecureBrowserPage = async (targetUrl) => {
  const desiredUrl = targetUrl || DEFAULT_SECURE_BROWSER_URL
  return runSecureBrowserAction(async (sessionId) => {
    await navigateSeleniumSession(sessionId, desiredUrl)
    return sessionId
  })
}

app.use(cors())
app.use(bodyParser.json())

app.post('/secure-browser/open-default', async (req, res) => {
  const requestedUrl = String(req.body?.url || '').trim()
  const targetUrl = requestedUrl || DEFAULT_SECURE_BROWSER_URL

  try {
    const sessionId = await ensureSecureBrowserPage(targetUrl)
    res.json({ ok: true, url: targetUrl, sessionId })
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error || 'Unable to open secure browser page') })
  }
})

app.get('/secure-browser/status', async (_req, res) => {
  const seleniumOnline = await checkEndpoint('http://localhost:4444/status')
  const novncOnline = await checkEndpoint('http://localhost:7900/vnc.html?autoconnect=1')

  res.json({
    ok: true,
    online: seleniumOnline && novncOnline,
    seleniumOnline,
    novncOnline,
    checkedAt: new Date().toISOString(),
  })
})

app.post('/secure-browser/restart', async (_req, res) => {
  try {
    const output = await secureBrowserComposeExec(['restart', 'secure-browser'])
    secureBrowserSessionId = null

    const seleniumOnline = await checkEndpoint('http://localhost:4444/status')
    const novncOnline = await checkEndpoint('http://localhost:7900/vnc.html?autoconnect=1')

    res.json({
      ok: true,
      output,
      online: seleniumOnline && novncOnline,
      seleniumOnline,
      novncOnline,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error || 'Unable to restart secure browser service') })
  }
})

app.post('/secure-browser/navigate', async (req, res) => {
  const requestedUrl = String(req.body?.url || '').trim()
  if (!requestedUrl) {
    return res.status(400).json({ ok: false, error: 'Missing url' })
  }

  try {
    const sessionId = await ensureSecureBrowserPage(requestedUrl)
    const currentUrl = await runSecureBrowserAction((id) => getCurrentSeleniumUrl(id))
    res.json({ ok: true, sessionId, url: currentUrl })
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error || 'Unable to navigate secure browser') })
  }
})

app.post('/secure-browser/back', async (_req, res) => {
  try {
    const sessionId = await runSecureBrowserAction(async (id) => {
      await runSeleniumSessionCommand(id, 'back')
      return id
    })
    const currentUrl = await runSecureBrowserAction((id) => getCurrentSeleniumUrl(id))
    res.json({ ok: true, sessionId, url: currentUrl })
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error || 'Unable to go back in secure browser') })
  }
})

app.post('/secure-browser/forward', async (_req, res) => {
  try {
    const sessionId = await runSecureBrowserAction(async (id) => {
      await runSeleniumSessionCommand(id, 'forward')
      return id
    })
    const currentUrl = await runSecureBrowserAction((id) => getCurrentSeleniumUrl(id))
    res.json({ ok: true, sessionId, url: currentUrl })
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error || 'Unable to go forward in secure browser') })
  }
})

app.post('/secure-browser/refresh', async (_req, res) => {
  try {
    const sessionId = await runSecureBrowserAction(async (id) => {
      await runSeleniumSessionCommand(id, 'refresh')
      return id
    })
    const currentUrl = await runSecureBrowserAction((id) => getCurrentSeleniumUrl(id))
    res.json({ ok: true, sessionId, url: currentUrl })
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error || 'Unable to refresh secure browser') })
  }
})

app.get('/secure-browser/current-url', async (_req, res) => {
  try {
    const sessionId = await ensureSecureBrowserSession()
    const currentUrl = await runSecureBrowserAction((id) => getCurrentSeleniumUrl(id))
    res.json({ ok: true, sessionId, url: currentUrl })
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error || 'Unable to read secure browser URL') })
  }
})

app.get('/runtime/apps/status', async (_req, res) => {
  const statuses = await Promise.all(
    RUNTIME_APPS.map(async (appItem) => ({
      ...appItem,
      online: await checkEndpoint(appItem.endpoint),
    })),
  )

  res.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    services: statuses,
  })
})

app.post('/runtime/apps/up', async (_req, res) => {
  try {
    const output = await runCompose(['up', '-d'])
    res.json({ ok: true, output })
  } catch (error) {
    const mapped = mapRuntimeCommandError(error)
    res.status(500).json({ ok: false, error: mapped.message, code: mapped.code, details: mapped.raw })
  }
})

app.post('/runtime/apps/down', async (_req, res) => {
  try {
    const output = await runCompose(['down'])
    res.json({ ok: true, output })
  } catch (error) {
    const mapped = mapRuntimeCommandError(error)
    res.status(500).json({ ok: false, error: mapped.message, code: mapped.code, details: mapped.raw })
  }
})

app.post('/runtime/apps/install', async (req, res) => {
  const appId = String(req.body?.appId || '')
  if (!runtimeAppExists(appId)) {
    return res.status(404).json({ ok: false, error: `Runtime app not found: ${appId}` })
  }

  const service = getServiceName(appId)
  try {
    const output = await runCompose(['up', '-d', service])
    res.json({ ok: true, appId, service, output })
  } catch (error) {
    const mapped = mapRuntimeCommandError(error)
    res.status(500).json({ ok: false, appId, service, error: mapped.message, code: mapped.code, details: mapped.raw })
  }
})

app.post('/runtime/apps/uninstall', async (req, res) => {
  const appId = String(req.body?.appId || '')
  if (!runtimeAppExists(appId)) {
    return res.status(404).json({ ok: false, error: `Runtime app not found: ${appId}` })
  }

  const service = getServiceName(appId)
  try {
    const stopOutput = await runCompose(['stop', service]).catch(() => '')
    const rmOutput = await runCompose(['rm', '-f', service]).catch(() => '')
    res.json({ ok: true, appId, service, output: `${stopOutput}\n${rmOutput}`.trim() })
  } catch (error) {
    const mapped = mapRuntimeCommandError(error)
    res.status(500).json({ ok: false, appId, service, error: mapped.message, code: mapped.code, details: mapped.raw })
  }
})

// FILE MANAGER
const baseDir = "C:"

// 🔍 Endpoint per leggere il contenuto di una cartella (con info avanzate)
app.get('/files', (req, res) => {
  let requestedPath = req.query.path || 'C:/'
  if(requestedPath.startsWith(".")) return res.status(500).json({ error: "no such file or directory" })
  if(requestedPath.endsWith(":")) requestedPath += "/"
  const fullPath = path.resolve(requestedPath)

  fs.readdir(fullPath, { withFileTypes: true }, async (err, entries) => {
    if (err) return res.status(500).json({ error: err.message })

    const files = await Promise.all(entries.map(async entry => {
        const fullEntryPath = path.join(fullPath, entry.name)
        try {
            const stats = await fs.promises.stat(fullEntryPath)
            return {
              name: entry.name,
              type: entry.isDirectory() ? 'folder' : 'file',
              size: entry.isDirectory() ? null : stats.size,
              modifiedAt: stats.mtime,
              extension: path.extname(entry.name)
            }
        } catch (err) {
            //console.warn(`Impossibile accedere a ${entry.name}: ${err.message}`)
            return null // ignora questo file
        }
    }))
      res.json(files.filter(f => f !== null))

  })
})

// ✏️ Rinomina file o cartella
app.post('/rename', (req, res) => {
  const { oldPath, newPath } = req.body
  const fullOldPath = path.resolve(baseDir, oldPath)
  const fullNewPath = path.resolve(baseDir, newPath)

  fs.rename(fullOldPath, fullNewPath, err => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ success: true })
  })
})

// 🗑️ Elimina file o cartella
app.post('/delete', (req, res) => {
  const { targetPath } = req.body
  const fullPath = path.resolve(baseDir, targetPath)

  fs.stat(fullPath, (err, stats) => {
    if (err) return res.status(500).json({ error: err.message })

    if (stats.isDirectory()) {
      fs.rm(fullPath, { recursive: true, force: true }, err => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true })
      })
    } else {
      fs.unlink(fullPath, err => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true })
      })
    }
  })
})

// ✂️ Copia file o cartella
app.post('/copy', async (req, res) => {
  const { sourcePath, destinationPath } = req.body
  const src = path.resolve(baseDir, sourcePath)
  const dest = path.resolve(baseDir, destinationPath)

  const copyRecursive = async (src, dest) => {
    const stats = await fs.promises.stat(src)
    if (stats.isDirectory()) {
      await fs.promises.mkdir(dest, { recursive: true })
      const entries = await fs.promises.readdir(src)
      for (const entry of entries) {
        await copyRecursive(path.join(src, entry), path.join(dest, entry))
      }
    } else {
      await fs.promises.copyFile(src, dest)
    }
  }

  try {
    await copyRecursive(src, dest)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ✂️ Taglia (sposta file o cartella)
app.post('/move', (req, res) => {
  const { sourcePath, destinationPath } = req.body
  const src = path.resolve(baseDir, sourcePath)
  const dest = path.resolve(baseDir, destinationPath)

  fs.rename(src, dest, err => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ success: true })
  })
})

app.get('/drives', async (req, res) => {
    try {
      const drives = await drivelist.list()
  
      // Mappiamo i drive nel formato che vuoi
      const result = drives.map(drive => {
        return {
          name: drive.mountpoints.length > 0 ? drive.mountpoints[0].path.replace("\\", "") : '', // es. "C:"
          label: drive.description || '', // la descrizione del drive (etichetta)
          type: drive.isRemovable ? 'removable' :
                drive.isSystem ? 'system' :
                drive.isVirtual ? 'virtual' :
                'fixed',
          size: drive.size
        }
      })
  
      res.json(result)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
})
  
app.get('/read', async (req, res) => {
  const { path: filePath } = req.query;

  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'Percorso file non valido' });
  }

  const fullPath = path.resolve(baseDir, filePath);

  try {
    const stats = await fs.promises.stat(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Il percorso specificato è una cartella' });
    }

    const buffer = await fs.promises.readFile(fullPath);
    const mimeType = mime.lookup(fullPath) || 'application/octet-stream';

    if (mimeType.startsWith('text/')) {
      return res.json({ type: 'text', content: buffer.toString('utf-8') });
    }

    if (mimeType.startsWith('image/')) {
      const base64 = buffer.toString('base64');
      return res.json({
        type: 'image',
        content: `data:${mimeType};base64,${base64}`
      });
    }

    if (mimeType.startsWith('application/mp4')) {
      const base64 = buffer.toString('base64');
      return res.json({
        type: 'video',
        content: `data:video/mp4;base64,${base64}`
      });
    }

    if (mimeType === 'application/pdf') {
      const base64 = buffer.toString('base64');
      return res.json({
        type: 'pdf',
        content: `data:${mimeType};base64,${base64}`
      });
    }

    // Tipo sconosciuto o non gestito (eseguibili, archivi, ecc.)
    return res.json({ type: 'other', content: buffer.toString('base64') });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/web-proxy', async (req, res) => {
  const rawUrl = req.query.url;

  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).send('Missing url query parameter');
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return res.status(400).send('Invalid URL');
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return res.status(400).send('Only http/https URLs are supported');
  }

  const proxyPrefix = '/web-proxy?url='
  const toProxyUrl = (url) => `${proxyPrefix}${encodeURIComponent(url)}`

  const shouldProxyUrl = (value) => {
    if (!value) return false
    const trimmed = value.trim()
    if (!trimmed) return false
    if (trimmed.startsWith('#')) return false
    if (trimmed.startsWith('javascript:')) return false
    if (trimmed.startsWith('mailto:')) return false
    if (trimmed.startsWith('tel:')) return false
    if (trimmed.startsWith('data:')) return false
    if (trimmed.startsWith(proxyPrefix)) return false
    return true
  }

  const resolveAbsoluteUrl = (value, base) => {
    try {
      return new URL(value, base).toString()
    } catch {
      return null
    }
  }

  const rewriteSrcSet = (srcsetValue, baseUrl) => {
    return srcsetValue
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [candidate, descriptor] = entry.split(/\s+/, 2)
        if (!shouldProxyUrl(candidate)) return entry
        const absolute = resolveAbsoluteUrl(candidate, baseUrl)
        if (!absolute) return entry
        return descriptor ? `${toProxyUrl(absolute)} ${descriptor}` : toProxyUrl(absolute)
      })
      .join(', ')
  }

  const rewriteHtmlForProxy = (html, finalUrl) => {
    let rewritten = html
    rewritten = rewritten.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '')
    rewritten = rewritten.replace(/<meta[^>]+http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '')

    const baseTag = `<base href="${new URL(finalUrl).toString()}">`
    if (/<head[^>]*>/i.test(rewritten)) {
      rewritten = rewritten.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`)
    } else {
      rewritten = `${baseTag}${rewritten}`
    }

    rewritten = rewritten.replace(/\b(href|src|action)=(["'])(.*?)\2/gi, (full, attr, quote, value) => {
      if (!shouldProxyUrl(value)) return full
      const absolute = resolveAbsoluteUrl(value, finalUrl)
      if (!absolute) return full
      return `${attr}=${quote}${toProxyUrl(absolute)}${quote}`
    })

    rewritten = rewritten.replace(/\bsrcset=(["'])(.*?)\1/gi, (full, quote, value) => {
      return `srcset=${quote}${rewriteSrcSet(value, finalUrl)}${quote}`
    })

    const injection = `
<script>
(() => {
  const PROXY_PREFIX = '${proxyPrefix}';
  const postToHost = (payload) => {
    try {
      window.parent?.postMessage(payload, '*');
    } catch {
      // noop
    }
  };

  const currentTargetUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get('url');
      if (encoded) return decodeURIComponent(encoded);
    } catch {
      // noop
    }
    return window.location.href;
  };

  const emitNavigation = () => {
    postToHost({
      type: 'gh3sp-browser-nav',
      url: currentTargetUrl(),
      title: document.title || '',
    });
  };

  const toProxy = (value) => {
    if (!value) return value;
    const raw = String(value).trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('data:') || raw.startsWith(PROXY_PREFIX)) {
      return value;
    }
    try {
      const abs = new URL(raw, window.location.href);
      if (!['http:', 'https:'].includes(abs.protocol)) return value;
      return PROXY_PREFIX + encodeURIComponent(abs.toString());
    } catch {
      return value;
    }
  };

  const toProxyForRequest = (value) => {
    if (!value) return value;
    const raw = String(value).trim();
    if (!raw) return value;
    if (raw.startsWith(PROXY_PREFIX)) return raw;
    try {
      const abs = new URL(raw, window.location.href);
      if (!['http:', 'https:'].includes(abs.protocol)) return value;
      return PROXY_PREFIX + encodeURIComponent(abs.toString());
    } catch {
      return value;
    }
  };

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    const proxied = toProxy(href);
    if (!proxied || proxied === href) return;
    event.preventDefault();
    window.location.href = proxied;
  }, true);

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') {
      event.preventDefault();
      event.stopPropagation();
      postToHost({ type: 'gh3sp-browser-shortcut', shortcut: 'new-tab-search' });
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      event.stopPropagation();
      postToHost({ type: 'gh3sp-browser-shortcut', shortcut: 'focus-omnibox' });
    }
  }, true);

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const method = (form.getAttribute('method') || 'get').toLowerCase();
    if (method !== 'get') return;
    const action = form.getAttribute('action') || window.location.href;
    const params = new URLSearchParams(new FormData(form));
    const sep = action.includes('?') ? '&' : '?';
    const targetUrl = params.toString() ? (action + sep + params.toString()) : action;
    const proxied = toProxy(targetUrl);
    if (!proxied || proxied === targetUrl) return;
    event.preventDefault();
    window.location.href = proxied;
  }, true);

  const nativeOpen = window.open;
  window.open = function(url, ...args) {
    return nativeOpen.call(window, toProxy(url), ...args);
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    try {
      if (typeof input === 'string') {
        return nativeFetch(toProxyForRequest(input), init);
      }
      if (input instanceof Request) {
        return nativeFetch(new Request(toProxyForRequest(input.url), input), init);
      }
      return nativeFetch(input, init);
    } catch {
      return nativeFetch(input, init);
    }
  };

  const nativeXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    return nativeXhrOpen.call(this, method, toProxyForRequest(url), ...rest);
  };

  if (navigator.sendBeacon) {
    const nativeBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
      return nativeBeacon(toProxyForRequest(url), data);
    };
  }

  const nativePushState = history.pushState.bind(history);
  history.pushState = function(...args) {
    nativePushState(...args);
    emitNavigation();
  };

  const nativeReplaceState = history.replaceState.bind(history);
  history.replaceState = function(...args) {
    nativeReplaceState(...args);
    emitNavigation();
  };

  window.addEventListener('popstate', emitNavigation);
  window.addEventListener('hashchange', emitNavigation);
  window.addEventListener('load', emitNavigation);
  setTimeout(emitNavigation, 0);
})();
</script>`

    if (/<\/body>/i.test(rewritten)) {
      rewritten = rewritten.replace(/<\/body>/i, `${injection}</body>`)
    } else {
      rewritten += injection
    }

    return rewritten
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || 'text/html; charset=utf-8';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Proxy-Target', response.url);
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');

    if (!response.ok) {
      const message = await response.text();
      return res.status(response.status).send(message || `Proxy error ${response.status}`);
    }

    if (contentType.includes('text/html')) {
      const html = await response.text();
      return res.send(rewriteHtmlForProxy(html, response.url || targetUrl.toString()));
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return res.send(buffer);
  } catch (error) {
    return res.status(500).send(`Proxy request failed: ${error.message}`);
  }
});

const server = app.listen(PORT, () => {
  console.log(`📂 File Manager backend attivo su http://localhost:${PORT}`)
})


// WEB SOCKET
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let ssh = null;
  let shellStream = null;

  const closeSsh = () => {
    if (shellStream) {
      try {
        shellStream.end();
      } catch {
        // ignore shell stream close errors
      }
      shellStream = null;
    }
    if (ssh) {
      try {
        ssh.end();
      } catch {
        // ignore ssh close errors
      }
      ssh = null;
    }
  };

  const safeSend = (payload) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  };

  ws.on("message", (msg) => {
    let parsed;
    try {
      parsed = JSON.parse(msg.toString());
    } catch (err) {
      console.error("❌ Errore parsing input:", err);
      return;
    }

    if (parsed?.type === "connect") {
      const host = String(parsed.host || "").trim();
      const username = String(parsed.username || "").trim();
      const password = typeof parsed.password === "string" ? parsed.password : "";
      const portRaw = Number.parseInt(String(parsed.port || 22), 10);
      const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 22;

      if (!host || !username) {
        safeSend({ type: "status", message: "Parametri SSH mancanti (host/username)" });
        return;
      }

      closeSsh();
      ssh = new Client();

      ssh
        .on("ready", () => {
          console.log(`✅ Connessione SSH riuscita (${username}@${host}:${port})`);
          safeSend({ type: "status", message: `Connesso a ${username}@${host}:${port}` });

          ssh.shell((err, stream) => {
            if (err) {
              safeSend({ type: "status", message: `Errore shell SSH: ${err.message}` });
              return;
            }

            shellStream = stream;

            stream.on("data", (data) => {
              safeSend({ type: "output", data: data.toString() });
            });

            stream.on("close", () => {
              shellStream = null;
              safeSend({ type: "status", message: "Connessione SSH chiusa" });
              closeSsh();
              if (ws.readyState === WebSocket.OPEN) {
                ws.close();
              }
            });
          });
        })
        .on("close", () => {
          console.log("❌ Connessione SSH chiusa");
          safeSend({ type: "status", message: "Connessione SSH chiusa" });
          closeSsh();
        })
        .on("error", (err) => {
          console.error("❗ Errore SSH:", err.message);
          safeSend({ type: "status", message: `Errore SSH: ${err.message}` });
          closeSsh();
        })
        .connect({
          host,
          port,
          username,
          password,
        });

      return;
    }

    if (parsed?.type === "input") {
      if (shellStream) {
        shellStream.write(typeof parsed.data === "string" ? parsed.data : "");
      }
      return;
    }

    if (parsed?.type === "disconnect") {
      closeSsh();
      safeSend({ type: "status", message: "Disconnesso" });
      return;
    }
  });

  ws.on("close", () => {
    closeSsh();
  });
});
