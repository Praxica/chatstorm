export const encodeAvatarSvg = (svg: string | undefined): string => {
  try {
    return svg ? `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` : ''
  } catch {
    return ''
  }
}
