import { v3 } from '@google-cloud/translate'

let client: v3.TranslationServiceClient | null = null
let parent: string | null = null

export function getGoogleTranslateClient() {
  if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
    return null
  }
  if (!client) {
    try {
      client = new v3.TranslationServiceClient()
      parent = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/global`
    } catch (err) {
      console.error('[translation] Google client init failed:', err)
      return null
    }
  }
  return { client, parent: parent! }
}

export function isTranslationEnabled(): boolean {
  return !!process.env.GOOGLE_CLOUD_PROJECT_ID
}
