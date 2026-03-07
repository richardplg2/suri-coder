import { app } from 'electron'

export function makeAppWithSingleInstanceLock(fn: () => void) {
  if (process.env.NODE_ENV === 'test') {
    fn()
    return
  }

  const isPrimaryInstance = app.requestSingleInstanceLock()

  !isPrimaryInstance ? app.quit() : fn()
}
