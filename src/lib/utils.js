export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDuration(mins) {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

// Estimates walk + drive time from straight-line distance with routing factor
export function estimateCommute(taskLat, taskLng, userLat, userLng) {
  const dist = haversineMeters(userLat, userLng, taskLat, taskLng)
  const routed = dist * 1.35                           // ~35% longer than straight line
  const walkMins = Math.max(1, Math.round(routed / 83.3))   // 5 km/h = 83.3 m/min
  const driveMins = Math.max(2, Math.round(routed / 500))   // 30 km/h = 500 m/min
  const distLabel = dist < 1000
    ? `${Math.round(dist)}m`
    : `${(dist / 1000).toFixed(1)}km`
  return { walkLabel: formatDuration(walkMins), driveLabel: formatDuration(driveMins), distLabel }
}

// Photon (Komoot) autocomplete — prefix-aware, biases toward nearLat/nearLng
// Returns normalized {lat, lon, display_name} objects
export async function geocodePittsburgh(query, nearLat, nearLng, limit = 5) {
  const lat = nearLat ?? 40.4432   // default: CMU
  const lng = nearLng ?? -79.9428
  const params = new URLSearchParams({
    q: query,
    lat: String(lat),
    lon: String(lng),
    limit: String(limit + 3),   // fetch extra; we'll drop low-quality results
    lang: 'en',
  })
  const res = await fetch(`https://photon.komoot.io/api/?${params}`)
  const data = await res.json()

  // Type priority: named places/buildings beat generic roads/boundaries
  const TYPE_RANK = { amenity: 0, building: 0, shop: 0, tourism: 0, leisure: 0,
                      office: 0, university: 0, place: 1, highway: 2 }
  function typeRank(r) { return TYPE_RANK[r.type] ?? 1 }

  const results = data.features
    .map(f => {
      const p = f.properties
      const name = p.name
      const addr = [p.housenumber, p.street].filter(Boolean).join(' ')
      const city = [p.city || p.town || p.village, p.state].filter(Boolean).join(', ')
      const display_name = [name, addr, city].filter(Boolean).join(', ')
      return {
        lat: String(f.geometry.coordinates[1]),
        lon: String(f.geometry.coordinates[0]),
        display_name,
        type: p.type ?? '',
      }
    })
    .filter(r => r.display_name)

  // Sort: type priority first, then proximity
  results.sort((a, b) => {
    const rankDiff = typeRank(a) - typeRank(b)
    if (rankDiff !== 0) return rankDiff
    const da = haversineMeters(lat, lng, parseFloat(a.lat), parseFloat(a.lon))
    const db = haversineMeters(lat, lng, parseFloat(b.lat), parseFloat(b.lon))
    return da - db
  })

  return results.slice(0, limit)
}
