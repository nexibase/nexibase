import { ComponentType } from 'react'
import RichTextEditor from './RichTextEditor'
import ImageBannerEditor from './ImageBannerEditor'
import HtmlEmbedEditor from './HtmlEmbedEditor'
import ButtonCtaEditor from './ButtonCtaEditor'
import SpacerEditor from './SpacerEditor'
import VideoEmbedEditor from './VideoEmbedEditor'

export interface WidgetEditorProps {
  settings: Record<string, unknown>
  onChange: (settings: Record<string, unknown>) => void
}

export const contentEditors: Record<string, ComponentType<WidgetEditorProps>> = {
  'rich-text': RichTextEditor,
  'image-banner': ImageBannerEditor,
  'html-embed': HtmlEmbedEditor,
  'button-cta': ButtonCtaEditor,
  'spacer': SpacerEditor,
  'video-embed': VideoEmbedEditor,
}
