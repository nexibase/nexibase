"use client"
import type { ComponentType } from 'react'
import { layoutManifest } from '@/layouts/_generated'
import { componentMap } from '@/layouts/_component-map'
import type { LayoutFolder, LayoutComponent } from '@/layouts/_generated'

/**
 * Get a layout component for the given folder and component name.
 * Falls back to 'default' if the component doesn't exist in the specified folder.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLayoutComponent(folder: string, component: LayoutComponent): ComponentType<any> {
  const validFolder = (folder in layoutManifest) ? folder as LayoutFolder : 'default'
  const manifest = layoutManifest[validFolder]

  // Check if the component exists in the specified folder
  const key = `${validFolder}/${component}`
  if (manifest.files[component] && componentMap[key]) {
    return componentMap[key]
  }

  // Fallback to default
  const defaultKey = `default/${component}`
  if (componentMap[defaultKey]) {
    return componentMap[defaultKey]
  }

  // Should never happen if default folder is valid
  throw new Error(`Layout component not found: ${component}`)
}

/**
 * Get all available layout folder names.
 */
export function getAvailableLayouts() {
  return Object.entries(layoutManifest).map(([key, value]) => ({
    folder: key,
    name: value.name,
    files: value.files,
  }))
}
