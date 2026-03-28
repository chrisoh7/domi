const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

const SYSTEM_PROMPT = `You are a content moderation system for Domi, a peer-to-peer errand marketplace for CMU students.

Your job is to classify task postings into one of three categories:
- "blocked": Clearly violates policy. Do NOT allow.
- "borderline": Possibly problematic, allow but flag for admin review.
- "clean": Fine to post.

Blocked content includes:
- Academic dishonesty (write my essay, take my quiz, do my homework, complete my assignment, answer exam questions)
- Illegal tasks (buy alcohol for a minor, anything drug-related)
- Dangerous physical tasks (anything that could injure the runner)
- Harassment targeting a specific person
- Sexually explicit content
- Spam or placeholder posts with no real intent

Borderline content includes:
- Vague tasks that could be misused
- Tasks that seem unusual but might be legitimate
- Edge cases of the above categories

Respond ONLY with raw valid JSON — no markdown, no code fences, no explanation. Exactly one of:
{"result":"clean","reason":null}
{"result":"borderline","reason":"brief explanation"}
{"result":"blocked","reason":"brief explanation"}`

/**
 * Uses Claude to moderate task title + description.
 * Returns { result: 'clean' | 'borderline' | 'blocked', reason: string | null }
 * Falls back to 'clean' if no API key or network error.
 */
export async function moderateContent(text) {
  console.log('[moderation] key present:', !!ANTHROPIC_KEY)
  if (!ANTHROPIC_KEY) {
    console.warn('[moderation] No API key — skipping, marking clean')
    return { result: 'clean', reason: null }
  }

  try {
    console.log('[moderation] Sending request for:', text.slice(0, 80))
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
        max_tokens: 100,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    })

    const data = await res.json()
    console.log('[moderation] Raw response:', data)

    const raw = data.content?.[0]?.text?.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
    console.log('[moderation] Parsed text:', raw)

    if (!raw) return { result: 'clean', reason: null }

    const parsed = JSON.parse(raw)
    console.log('[moderation] Final result:', parsed)
    return {
      result: parsed.result ?? 'clean',
      reason: parsed.reason ?? null,
    }
  } catch (err) {
    console.error('[moderation] Error:', err)
    return { result: 'clean', reason: null }
  }
}
