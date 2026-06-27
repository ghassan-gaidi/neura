'use client'

import { useEffect, useRef } from 'react'

const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789'

export default function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let columns: number[] = []
    let fontSize = 14
    const speeds: number[] = []
    // Track whether each column is currently active (to avoid overcrowding)
    let activeCols: boolean[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      fontSize = Math.max(12, Math.floor(window.innerWidth / 90))
      const cols = Math.ceil(canvas.width / fontSize)
      columns = Array.from({ length: cols }, () =>
        Math.floor(Math.random() * canvas.height * -1)
      )
      activeCols = Array.from({ length: cols }, () => Math.random() > 0.5)
      for (let i = 0; i < cols; i++) {
        speeds[i] = 1 + Math.random() * 2
      }
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      // Fast fade — clears old characters quickly, no grey buildup
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.font = `${fontSize}px "DM Mono", monospace`

      for (let i = 0; i < columns.length; i++) {
        if (!activeCols[i]) continue

        const x = i * fontSize
        const y = columns[i] * fontSize

        // Trail characters — dim
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
        ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], x, y - fontSize)

        // Lead character — bright white
        const char = CHARS[Math.floor(Math.random() * CHARS.length)]
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
        ctx.fillText(char, x, y)

        // Reset
        if (y > canvas.height + fontSize * 2) {
          columns[i] = Math.random() * -50
          speeds[i] = 1 + Math.random() * 2
          // Re-activate column occasionally
          activeCols[i] = Math.random() > 0.3
        }

        columns[i] += speeds[i]
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
