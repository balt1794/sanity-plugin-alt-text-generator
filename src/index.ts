import {definePlugin} from 'sanity'
import type {AltTextGeneratorConfig} from './context'
import {createAltTextGeneratorProvider} from './AltTextGeneratorProvider'
import {AltTextDashboard} from './AltTextDashboard'

export {AltTextImageInput} from './AltTextImageInput'
export {AltTextField} from './AltTextField'
export {AltTextDashboard} from './AltTextDashboard'
export type {AltTextGeneratorConfig} from './context'

/**
 * Usage in `sanity.config.ts`:
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {altTextGenerator} from 'sanity-plugin-alt-text-generator'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [altTextGenerator()],
 * })
 * ```
 *
 * No API key required at setup time — open the "Alt Text Generator" tool in
 * the Studio nav and paste your key into its Settings panel (get a free one
 * at alttextgeneratorai.com). You can also pass a default `apiKey` here for
 * local development/CI; the Settings-panel key takes priority once saved.
 *
 * Then wire it into your schema in one of two ways:
 *
 * 1. On the `alt` string field itself (recommended — puts the "Generate Alt
 *    Text" button right under Alternative Text, above any other fields like
 *    Caption):
 *
 * ```ts
 * defineField({
 *   name: 'alt',
 *   type: 'string',
 *   components: {input: AltTextField},
 * })
 * ```
 *
 * 2. On the whole image field (button renders below all of the image's
 *    fields at once):
 *
 * ```ts
 * defineField({
 *   name: 'mainImage',
 *   type: 'image',
 *   components: {input: AltTextImageInput},
 * })
 * ```
 *
 * @public
 */
export const altTextGenerator = definePlugin<AltTextGeneratorConfig | void>((config) => {
  const staticConfig = config || {}

  return {
    name: 'sanity-plugin-alt-text-generator',
    studio: {
      components: {
        layout: createAltTextGeneratorProvider(staticConfig),
      },
    },
    tools: (prev) => [
      ...prev,
      {
        name: 'alt-text-generator',
        title: 'Alt Text Generator',
        component: AltTextDashboard,
      },
    ],
  }
})
