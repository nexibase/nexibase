import Anthropic from '@anthropic-ai/sdk'

export interface ClaudeResponse {
  text: string
  inputTokens: number
  outputTokens: number
}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<ClaudeResponse> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const model = process.env.VIBE_RECIPES_CLAUDE_MODEL || 'claude-sonnet-4-5-20250929'

  const stream = await client.messages.stream({
    model,
    max_tokens: 48000,
    temperature: 0.8,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const response = await stream.finalMessage()

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text block in Claude response')
  }

  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      `Claude response truncated at max_tokens=48000 (output_tokens=${response.usage.output_tokens}). ` +
        `Try reducing step count or request simpler recipe.`
    )
  }

  return {
    text: textBlock.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}
