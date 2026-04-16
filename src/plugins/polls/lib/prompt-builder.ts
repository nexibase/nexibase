export function buildSystemPrompt(): string {
  return `You are a poll generator for a community website. When given a topic, create an engaging poll question with multiple options.

You MUST respond with valid JSON only, no other text. The JSON must follow this exact structure:
{
  "question": "The poll question",
  "description": "A brief description of the poll (optional, can be null)",
  "category": "A short category label (e.g. tech, lifestyle, food, entertainment)",
  "isMultiple": false,
  "options": [
    { "label": "Option text", "emoji": "relevant emoji" }
  ]
}

Rules:
- Create 3-6 options
- Each option should be concise (under 100 characters)
- Use a single relevant emoji per option
- The question should be engaging and clear
- Set isMultiple to true only when it makes sense for the topic`
}

export function buildUserPrompt(topic: string): string {
  return `Create a community poll about: ${topic}`
}

export interface AiPollResponse {
  question: string
  description: string | null
  category: string
  isMultiple: boolean
  options: { label: string; emoji: string }[]
}

export function parseAiResponse(text: string): AiPollResponse {
  // Try to find a JSON block in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response')
  }

  const parsed = JSON.parse(jsonMatch[0])

  // Validate required fields
  if (!parsed.question || !Array.isArray(parsed.options) || parsed.options.length < 2) {
    throw new Error('Invalid AI response structure')
  }

  return {
    question: parsed.question,
    description: parsed.description || null,
    category: parsed.category || null,
    isMultiple: parsed.isMultiple ?? false,
    options: parsed.options.map((opt: { label: string; emoji?: string }) => ({
      label: opt.label,
      emoji: opt.emoji || null,
    })),
  }
}
