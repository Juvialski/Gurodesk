import { useCallback, useEffect, useRef, useState } from 'react'
import type { OmrImageBuffer } from '../types/omr'

export type CameraStreamState = {
  isStreaming: boolean
  isLoading: boolean
  error: string | null
  hasTorch: boolean
  isTorchOn: boolean
  toggleTorch: () => Promise<void>
  captureFrame: (downscaleFactor?: number) => OmrImageBuffer | null
  videoRef: React.RefObject<HTMLVideoElement | null>
}

export function useCameraStream(active = true): CameraStreamState {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasTorch, setHasTorch] = useState(false)
  const [isTorchOn, setIsTorchOn] = useState(false)

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // Ignore
        }
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
    setIsTorchOn(false)
  }, [])

  const startStream = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported by your browser.')
      return
    }

    stopStream()
    setIsLoading(true)
    setError(null)

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1024 },
          height: { ideal: 1080, min: 720 },
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {
          // Auto-play might require user gesture on some devices
        })
      }

      // Check for torch capability
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as { torch?: boolean }
        setHasTorch(Boolean(capabilities.torch))
      }

      setIsStreaming(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to access camera.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [stopStream])

  useEffect(() => {
    if (active) {
      void startStream()
    } else {
      stopStream()
    }

    return () => {
      stopStream()
    }
  }, [active, startStream, stopStream])

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !hasTorch) return
    const videoTrack = streamRef.current.getVideoTracks()[0]
    if (!videoTrack) return

    try {
      const nextTorch = !isTorchOn
      await (videoTrack.applyConstraints as (c: unknown) => Promise<void>)({
        advanced: [{ torch: nextTorch }],
      })
      setIsTorchOn(nextTorch)
    } catch (e) {
      console.warn('[useCameraStream] Failed to toggle torch', e)
    }
  }, [hasTorch, isTorchOn])

  const captureFrame = useCallback((downscaleFactor = 1): OmrImageBuffer | null => {
    const video = videoRef.current
    if (!video || !isStreaming || video.videoWidth === 0 || video.videoHeight === 0) {
      return null
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
    const canvas = canvasRef.current
    const targetW = Math.floor(video.videoWidth / downscaleFactor)
    const targetH = Math.floor(video.videoHeight / downscaleFactor)

    canvas.width = targetW
    canvas.height = targetH

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    ctx.drawImage(video, 0, 0, targetW, targetH)
    const imageData = ctx.getImageData(0, 0, targetW, targetH)
    const rgba = imageData.data
    const grayscale = new Uint8Array(targetW * targetH)

    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
      // Standard ITU-R BT.601 luma formula
      grayscale[j] = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2])
    }

    return {
      width: targetW,
      height: targetH,
      data: grayscale,
    }
  }, [isStreaming])

  return {
    isStreaming,
    isLoading,
    error,
    hasTorch,
    isTorchOn,
    toggleTorch,
    captureFrame,
    videoRef,
  }
}
