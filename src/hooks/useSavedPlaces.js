import { useState, useEffect } from 'react'

export const PRESET_DEFS = [
  { key: 'home',   name: 'Home',   emoji: '🏠' },
  { key: 'work',   name: 'Work',   emoji: '💼' },
  { key: 'school', name: 'School', emoji: '🎓' },
]

function storageKey(userId) {
  return `domi_places_${userId || 'anon'}`
}

function loadPlaces(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? JSON.parse(raw) : { presets: {}, custom: [] }
  } catch {
    return { presets: {}, custom: [] }
  }
}

export function useSavedPlaces(userId) {
  const [data, setData] = useState(() => loadPlaces(userId))

  useEffect(() => {
    localStorage.setItem(storageKey(userId), JSON.stringify(data))
  }, [data, userId])

  // Flat list of all places that have coordinates set
  const allPlaces = [
    ...PRESET_DEFS
      .filter(p => data.presets[p.key]?.lat)
      .map(p => ({ ...p, ...data.presets[p.key] })),
    ...data.custom,
  ]

  // All preset slots including unset ones (for the manager UI)
  const presets = PRESET_DEFS.map(p => ({
    ...p,
    ...(data.presets[p.key] || {}),
    isSet: !!data.presets[p.key]?.lat,
  }))

  function savePreset(key, { label, lat, lng }) {
    setData(d => ({ ...d, presets: { ...d.presets, [key]: { label, lat, lng } } }))
  }

  function clearPreset(key) {
    setData(d => {
      const next = { ...d.presets }
      delete next[key]
      return { ...d, presets: next }
    })
  }

  function addCustom({ name, emoji, label, lat, lng }) {
    setData(d => ({
      ...d,
      custom: [...d.custom, { id: crypto.randomUUID(), name, emoji, label, lat, lng }],
    }))
  }

  function removeCustom(id) {
    setData(d => ({ ...d, custom: d.custom.filter(c => c.id !== id) }))
  }

  return { allPlaces, presets, custom: data.custom, savePreset, clearPreset, addCustom, removeCustom }
}
