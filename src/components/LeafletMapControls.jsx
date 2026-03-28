import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

export function WheelPanAndCtrlZoom() {
  const map = useMap()
  const wheelAccumulator = useRef(0)
  const panDelta = useRef({ x: 0, y: 0 })
  const panFrame = useRef(null)

  useEffect(() => {
    const container = map.getContainer()
    const originalZoomSnap = map.options.zoomSnap
    const originalZoomDelta = map.options.zoomDelta

    L.setOptions(map, { zoomSnap: 0.25, zoomDelta: 0.25 })

    function normalizeWheelDelta(event) {
      const lineHeight = 16
      const pageHeight = container.clientHeight || 800
      const factor = event.deltaMode === 1 ? lineHeight : event.deltaMode === 2 ? pageHeight : 1
      return {
        x: event.deltaX * factor,
        y: event.deltaY * factor,
      }
    }

    function flushPan() {
      panFrame.current = null
      const { x, y } = panDelta.current
      if (x !== 0 || y !== 0) {
        map.panBy([x, y], { animate: false })
        panDelta.current = { x: 0, y: 0 }
      }
    }

    function handleWheel(event) {
      const delta = normalizeWheelDelta(event)
      event.preventDefault()
      event.stopPropagation()

      if (event.ctrlKey || event.metaKey) {
        wheelAccumulator.current += delta.y
        const threshold = 60
        if (Math.abs(wheelAccumulator.current) < threshold) return

        const direction = wheelAccumulator.current < 0 ? 1 : -1
        wheelAccumulator.current = 0
        const maxZoom = Number.isFinite(map.getMaxZoom()) ? map.getMaxZoom() : map.getZoom() + 1
        const minZoom = Number.isFinite(map.getMinZoom()) ? map.getMinZoom() : map.getZoom() - 1
        const nextZoom = Math.max(minZoom, Math.min(maxZoom, map.getZoom() + (direction * 0.25)))
        const containerPoint = map.mouseEventToContainerPoint(event)
        map.setZoomAround(containerPoint, nextZoom, { animate: false })
        return
      }

      wheelAccumulator.current = 0
      panDelta.current = {
        x: panDelta.current.x + (delta.x * 0.75),
        y: panDelta.current.y + (delta.y * 0.75),
      }

      if (panFrame.current == null) {
        panFrame.current = window.requestAnimationFrame(flushPan)
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      wheelAccumulator.current = 0
      if (panFrame.current != null) {
        window.cancelAnimationFrame(panFrame.current)
      }
      L.setOptions(map, { zoomSnap: originalZoomSnap, zoomDelta: originalZoomDelta })
      panFrame.current = null
      panDelta.current = { x: 0, y: 0 }
      container.removeEventListener('wheel', handleWheel)
    }
  }, [map])

  return null
}

export function MapRecenterControl({ positions, focusPosition }) {
  const map = useMap()
  const latestPositions = useRef(positions)
  const latestFocus = useRef(focusPosition)

  useEffect(() => {
    latestPositions.current = positions
    latestFocus.current = focusPosition
  }, [positions, focusPosition])

  useEffect(() => {
    function recenter() {
      const currentPositions = latestPositions.current

      if (!currentPositions || currentPositions.length === 0) return
      const uniquePositions = currentPositions.filter((position, index, array) =>
        array.findIndex(candidate => candidate[0] === position[0] && candidate[1] === position[1]) === index
      )

      if (uniquePositions.length >= 2) {
        map.fitBounds(uniquePositions, { padding: [28, 28], maxZoom: 16 })
        return
      }

      const currentFocus = latestFocus.current
      const fallback = uniquePositions[0] ?? currentFocus
      if (fallback) {
        map.flyTo(fallback, 15, { duration: 0.4 })
      }
    }

    const control = L.control({ position: 'topright' })
    control.onAdd = () => {
      const button = L.DomUtil.create('button', '')
      button.type = 'button'
      button.textContent = 'Re-center'
      button.style.background = 'rgba(255,255,255,0.95)'
      button.style.border = '1px solid rgba(203,213,225,1)'
      button.style.borderRadius = '10px'
      button.style.padding = '6px 10px'
      button.style.fontSize = '12px'
      button.style.fontWeight = '600'
      button.style.color = '#0f172a'
      button.style.boxShadow = '0 1px 4px rgba(15,23,42,0.15)'
      button.style.cursor = 'pointer'
      L.DomEvent.disableClickPropagation(button)
      L.DomEvent.on(button, 'click', event => {
        L.DomEvent.stop(event)
        recenter()
      })
      return button
    }

    control.addTo(map)
    return () => control.remove()
  }, [map])

  return null
}
