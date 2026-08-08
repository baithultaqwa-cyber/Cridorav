import { useCallback, useEffect, useRef, useState } from 'react'
import coinFaceUrl from '../../assets/cridora-coin-face.png'
import './homeHeroCoin.css'

const RIM_SEGMENTS = 96

/**
 * Interactive CSS 3D Cridora coin for the Home hero.
 * Pointer tilt / drag spin; soft idle spin when idle.
 * Black square from the face PNG is clipped — no opaque backdrop.
 */
export default function HomeHeroCoin() {
  const stageRef = useRef(null)
  const rafRef = useRef(0)
  const targetRef = useRef({ rx: 18, ry: 0 })
  const currentRef = useRef({ rx: 18, ry: 0 })
  const draggingRef = useRef(false)
  const hoveringRef = useRef(false)
  const lastPtrRef = useRef({ x: 0, y: 0 })
  const reduceMotion = useRef(false)
  const [style, setStyle] = useState({
    transform: 'rotateX(18deg) rotateY(0deg)',
  })

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    const tick = () => {
      const t = targetRef.current
      const c = currentRef.current
      const ease = draggingRef.current ? 0.28 : 0.12

      if (
        !draggingRef.current &&
        !hoveringRef.current &&
        !reduceMotion.current
      ) {
        t.ry += 0.4
        t.rx = 16 + Math.sin(t.ry * 0.035) * 5
      }

      c.rx += (t.rx - c.rx) * ease
      c.ry += (t.ry - c.ry) * ease

      setStyle({
        transform: `rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg)`,
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const pointInStage = useCallback((clientX, clientY) => {
    const el = stageRef.current
    if (!el) return { nx: 0, ny: 0 }
    const r = el.getBoundingClientRect()
    const nx = ((clientX - r.left) / r.width) * 2 - 1
    const ny = ((clientY - r.top) / r.height) * 2 - 1
    return {
      nx: Math.max(-1, Math.min(1, nx)),
      ny: Math.max(-1, Math.min(1, ny)),
    }
  }, [])

  const onPointerEnter = useCallback(() => {
    hoveringRef.current = true
  }, [])

  const onPointerMove = useCallback(
    (e) => {
      hoveringRef.current = true
      const { nx, ny } = pointInStage(e.clientX, e.clientY)
      if (draggingRef.current) {
        const dx = e.clientX - lastPtrRef.current.x
        lastPtrRef.current = { x: e.clientX, y: e.clientY }
        targetRef.current.ry += dx * 0.6
        targetRef.current.rx = Math.max(-30, Math.min(40, 12 + ny * -24))
        return
      }
      targetRef.current.rx = 12 + ny * -22
      targetRef.current.ry += nx * 2.2
    },
    [pointInStage],
  )

  const onPointerDown = useCallback((e) => {
    draggingRef.current = true
    hoveringRef.current = true
    lastPtrRef.current = { x: e.clientX, y: e.clientY }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const endDrag = useCallback((e) => {
    draggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const onPointerLeave = useCallback(() => {
    hoveringRef.current = false
    draggingRef.current = false
    targetRef.current.rx = 18
  }, [])

  return (
    <div
      ref={stageRef}
      className="home-hero-coin"
      role="img"
      aria-label="Cridora gold coin — drag to spin"
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={onPointerLeave}
    >
      <span className="home-hero-coin__glow" aria-hidden />
      <span className="home-hero-coin__shadow" aria-hidden />
      <div
        className="home-hero-coin__3d"
        style={{ ...style, '--hhc-rim-segments': RIM_SEGMENTS }}
      >
        <div className="home-hero-coin__cylinder" aria-hidden>
          {Array.from({ length: RIM_SEGMENTS }, (_, i) => (
            <div
              key={i}
              className="home-hero-coin__strip"
              style={{ '--strip-i': i }}
            />
          ))}
        </div>
        <div className="home-hero-coin__face home-hero-coin__face--front">
          <img
            className="home-hero-coin__face-img"
            src={coinFaceUrl}
            alt=""
            draggable={false}
            decoding="async"
          />
          <span className="home-hero-coin__face-light home-hero-coin__face-light--front" />
        </div>
        <div className="home-hero-coin__face home-hero-coin__face--back">
          <img
            className="home-hero-coin__face-img"
            src={coinFaceUrl}
            alt=""
            draggable={false}
            decoding="async"
          />
          <span className="home-hero-coin__face-light home-hero-coin__face-light--back" />
        </div>
      </div>
    </div>
  )
}
