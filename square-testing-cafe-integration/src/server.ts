import { buildApp } from './app'
import { loadConfig } from './config'

const start = async (): Promise<void> => {
  const config = loadConfig()
  const app = buildApp({ config })

  try {
    await app.listen({
      host: config.host,
      port: config.port,
    })
  } catch (error) {
    app.log.error(error, 'failed to start server')
    process.exit(1)
  }
}

void start()
