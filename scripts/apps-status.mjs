const services = [
  { id: 'notepad', endpoint: 'http://localhost:4101' },
  { id: 'file-explorer', endpoint: 'http://localhost:4102' },
  { id: 'terminal', endpoint: 'http://localhost:4103' },
  { id: 'browser', endpoint: 'http://localhost:4104' },
]

const check = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1800)
  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

const statuses = await Promise.all(
  services.map(async (service) => ({ ...service, online: await check(service.endpoint) })),
)

console.log(`Runtime status (${new Date().toISOString()})`)
console.log('service'.padEnd(16) + 'status'.padEnd(10) + 'endpoint')
for (const service of statuses) {
  console.log(service.id.padEnd(16) + (service.online ? 'online' : 'offline').padEnd(10) + service.endpoint)
}
