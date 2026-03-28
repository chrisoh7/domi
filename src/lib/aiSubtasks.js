const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

export const hasAiKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY

/**
 * Uses Claude to generate steps (description + location) for a doum posting.
 * Returns { steps: { description: string, location: string }[] }
 * Returns null on failure or missing key.
 */
export async function generateSubtasks(title, description, homeLocation = null) {
  if (!ANTHROPIC_KEY) return null

  const locationLine = homeLocation
    ? `Poster's home / delivery location: "${homeLocation}"`
    : ''

  const prompt = `You are helping break down a task on domi, a campus helping platform for CMU students in Pittsburgh.

Task title: "${title}"
Task description: "${description}"
${locationLine}

Break this task into 2–4 steps. Each step has a short action label and a location where it happens.

Respond with raw JSON only — no markdown:
{
  "steps": [
    { "description": "Short action (≤6 words)", "location": "Searchable building or address" }
  ]
}

Rules:
- Descriptions must be ≤6 words, verb-led, and include key details (IDs, codes) if present
- Locations: use full searchable names (e.g. "UC" → "University Center Carnegie Mellon", "Cohon" → "Cohon University Center CMU")
- If the task involves picking something up (package, food, item, groceries, etc.), always include a final drop-off/delivery step
  - Use the poster's home location if provided above; otherwise use whatever delivery destination is mentioned or implied in the description
  - If no destination is known at all, omit the drop-off step rather than guessing
- Omit any step or location you are not confident about`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    const raw = data.content?.[0]?.text?.trim()
      .replace(/^```json\s*/i, '').replace(/```$/, '').trim()
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}
