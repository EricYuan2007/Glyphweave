import { execa } from 'execa'
export async function verifyPdf(file: string) {
  const { stdout } = await execa('pdffonts', [file])
  const fonts = stdout.trim().split('\n').slice(2)
  if (
    !fonts.length ||
    fonts.some((font) => !/\s+yes\s+(?:yes|no)\s+(?:yes|no)\s+\d+\s+\d+\s*$/.test(font))
  )
    throw new Error(`PDF has missing or unembedded fonts: ${file}`)
}
