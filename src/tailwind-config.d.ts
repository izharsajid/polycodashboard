/** The design tokens, read where a colour is needed outside a class name (the 3D plant view). */
declare module '*/tailwind.config.js' {
  type Shade = string | { DEFAULT: string; wash?: string; 2?: string }
  const config: { theme: { colors: Record<string, Shade | Record<string, string>> } }
  export default config
}
