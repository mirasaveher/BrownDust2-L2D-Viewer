const iconModules = import.meta.glob('../assets/char_icons/*.png', {
  eager: true,
  import: 'default',
})

const iconMap = Object.entries(iconModules).reduce((result, [assetPath, assetUrl]) => {
  const fileName = assetPath.slice(assetPath.lastIndexOf('/') + 1)
  const marker = fileName.lastIndexOf('icon_char')
  if (marker < 0 || !fileName.endsWith('.png')) return result

  const characterKey = fileName.slice(marker + 'icon_char'.length, -'.png'.length)
  if (characterKey === 'unknown' || /^\d+$/.test(characterKey)) {
    result[characterKey] = assetUrl
  }

  return result
}, {})

export default iconMap
