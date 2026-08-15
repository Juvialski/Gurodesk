import { useEffect, useState } from 'react'

export interface OnlineStatus {
  isOnline: boolean
  wasOffline: boolean
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true
  })
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      setWasOffline(true)
      const timer = window.setTimeout(() => {
        setWasOffline(false)
      }, 4000)
      return () => window.clearTimeout(timer)
    }

    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, wasOffline }
}
