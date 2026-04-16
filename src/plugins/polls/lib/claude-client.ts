import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function callClaude(systemPrompt: string, userPrompt: string) {
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929'

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  const text = textBlock ? textBlock.text : ''

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}
