import { AppError } from './errors'

export const assertInternalAuth = (authorizationHeader: string | undefined, token: string): void => {
  if (!authorizationHeader) {
    throw new AppError('UNAUTHORIZED', 'Missing Authorization header', 401)
  }

  if (!authorizationHeader.toLowerCase().startsWith('bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Invalid Authorization header format', 401)
  }

  const candidate = authorizationHeader.slice('bearer '.length)
  if (candidate !== token) {
    throw new AppError('UNAUTHORIZED', 'Invalid internal API token', 401)
  }
}
