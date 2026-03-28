import { useState, useEffect } from 'react'

function storageKey(userId) {
  return `domi_templates_${userId || 'anon'}`
}

function load(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useDoumTemplates(userId) {
  const [templates, setTemplates] = useState(() => load(userId))

  useEffect(() => {
    localStorage.setItem(storageKey(userId), JSON.stringify(templates))
  }, [templates, userId])

  function addTemplate({ name, emoji, title, description, category }) {
    setTemplates(prev => [...prev, { id: crypto.randomUUID(), name, emoji: emoji || '📋', title, description, category }])
  }

  function removeTemplate(id) {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  return { templates, addTemplate, removeTemplate }
}
