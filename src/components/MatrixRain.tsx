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

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      fontSize = Math.max(12, Math.floor(window.innerWidth / 90))
      const cols = Math.ceil(canvas.width / fontSize)
      columns = Array.from({ length: cols }, () =>
        Math.floor(Math.random() * canvas.height * -1)
      )
      for (let i = 0; i < cols; i++) {
        speeds[i] = 0.5 + Math.random() * 1.5
      }
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      // Fade trail
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.font = `${fontSize}px "DM Mono", monospace`

      for (let i = 0; i < columns.length; i++) {
        const x = i * fontSize
        const y = columns[i] * fontSize

        // Main character — faint white
        const char = CHARS[Math.floor(Math.random() * CHARS.length)]
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
        ctx.fillText(char, x, y)

        // Reset
        if (y > canvas.height) {
          columns[i] = Math.random() * -20
          speeds[i] = 0.5 + Math.random() * 1.5
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
