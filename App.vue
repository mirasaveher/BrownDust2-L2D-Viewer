<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SpinePreview from './components/SpinePreview.vue'
import characterRegistry from './src/data/character-list.json'
import characterIcons from './src/utils/charIcons.js'
import cutsceneMappings from './src/data/cutscene-mappings.json'
import {
  Activity, AudioLines, BookOpen, Camera, ChevronDown, ChevronLeft, ChevronRight,
  Clapperboard, CloudUpload, Command, Download, Expand,
  Eye, EyeOff, Film, FolderOpen, Heart, Image, Layers3, Minimize2, Minus,
  MoreHorizontal, Pause, Play, Plus, RotateCcw, Search, Settings2, SlidersHorizontal,
  Sparkles, Volume2, WandSparkles, X
} from 'lucide-vue-next'

const activeTab = ref('viewer')
function getCharacterFolderName(character, id) {
  if (id === 'ellin') return 'Ellin'
  return [character.charName, character.costumeName].filter(Boolean).join(' ').replace(/\s*\(Npc\)\s*/gi, ' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '').replace(/&/g, ' And ').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_')
}
function returnToStart() {
  window.location.reload()
}
const audioLanguage = ref(typeof window !== 'undefined' && window.localStorage.getItem('browndust2-l2d-viewer-audio-language') === 'KR' ? 'KR' : 'JP')
const search = ref('')
const caseSensitive = ref(false)
const activeFilters = ref([])
const pendingFilters = ref([])
const filtersOpen = ref(false)
const filtersAreaRef = ref(null)
const activeCatalogMode = ref('animations')
const availableLayers = ref([])
const layerVisibility = ref({})
const sortBy = ref('name-asc')
const selectedCharacter = ref('003501')
const characterOpened = ref(false)
const activeSpineSet = ref('character')
const datingAnimationSets = ref({})
const selectedCharacterData = computed(() => characterRegistry[selectedCharacter.value] || characterRegistry['000101'])
const selectedCharacterName = computed(() => selectedCharacterData.value.charName)
const activeCostumeTitle = computed(() => [selectedCharacterData.value.costumeName, selectedCharacterData.value.charName.replace(/\s*\(npc\)$/i, '')].filter(Boolean).join(' '))
const timelineHoverProgress = ref(0)
const activeComposites = computed(() => activeSpineSet.value === 'ultimate' ? (cutsceneMappings[selectedCharacter.value] || []) : [])
const characterAssetRoot = computed(() => {
  const character = selectedCharacterData.value
  const folderName = getCharacterFolderName(character, selectedCharacter.value)
  return `${import.meta.env.BASE_URL}${selectedCharacter.value}/${folderName}/`
})
const multiDatingVariants = computed(() => selectedCharacterData.value.datingVariants || [])
const datingPreloadVariant = computed(() => multiDatingVariants.value[1] || '')
const datingPreloadAssetBase = computed(() => datingPreloadVariant.value ? characterAssetRoot.value + `dating/${datingPreloadVariant.value}` : '')
const activeDatingVariant = computed(() => {
  if (activeSpineSet.value !== 'dating') return ''
  const keyVariant = selectedAnimation.value.includes('::') ? selectedAnimation.value.split('::')[0] : ''
  return keyVariant || multiDatingVariants.value[0] || selectedCharacterData.value.dating || ''
})
const activeAssetBase = computed(() => {
  const character = selectedCharacterData.value
  const root = characterAssetRoot.value
  if (activeSpineSet.value === 'ultimate') return character.cutscene ? root + `cutscene/${character.cutscene}` : ''
  if (activeSpineSet.value === 'dating') { const datingAsset = activeDatingVariant.value || character.dating; return datingAsset ? root + `dating/${datingAsset}` : '' }
  return root + character.spine
})
const previewAnimation = computed(() => activeSpineSet.value === 'dating' && selectedAnimation.value.includes('::') ? selectedAnimation.value.slice(selectedAnimation.value.indexOf('::') + 2) : selectedAnimation.value)
const datingAnimationCatalog = computed(() => multiDatingVariants.value.flatMap(variant => (datingAnimationSets.value[variant] || []).map(name => ({ key: `${variant}::${name}`, label: name }))))
const selectedAudioBase = computed(() => {
  const character = selectedCharacterData.value
  if (!character.audio || !/^\d+(?:_c)?$/i.test(selectedCharacter.value)) return ''
  const folderName = getCharacterFolderName(character, selectedCharacter.value)
  return `${import.meta.env.BASE_URL}${selectedCharacter.value}/${folderName}/${audioLanguage.value}/${character.audio}`
})
const selectedMotion = ref('Idle')
const playing = ref(true)
const showImport = ref(false)
const importedFiles = ref([])
const spineFiles = ref([])
const availableAnimations = ref([])
const selectedAnimation = ref('')
const availableSkins = ref([])
const selectedSkin = ref('')
const skinMenuOpen = ref(false)
const layerSearch = ref('')
const filteredLayers = computed(() => {
  const query = layerSearch.value.trim().toLocaleLowerCase()
  return query ? availableLayers.value.filter((name) => name.toLocaleLowerCase().includes(query)) : availableLayers.value
})
const importError = ref('')
const loopPlayback = ref(true)
const previewScale = ref(100)
const playbackSpeed = ref(1)
const isFavorite = ref(false)
const stageRef = ref(null)
const spinePreviewRef = ref(null)
const isScreenshotting = ref(false)
const isFullscreen = ref(false)
const fullscreenControlsHidden = ref(false)
const transparentScreenshot = ref(false)
const useCurrentCameraForExport = ref(false)
const isExportingAnimation = ref(false)
const exportMenuOpen = ref(false)
const exportMenuRef = ref(null)
const cameraMenuOpen = ref(false)
const cameraMenuRef = ref(null)
const audioMenuOpen = ref(false)
const audioMenuRef = ref(null)
let fullscreenHideTimer = 0
const playbackProgress = ref(0)
const animationDuration = ref(0)
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}
const characters = Object.entries(characterRegistry).map(([id, item]) => ({
  id, charName: item.charName, displayName: item.charName.replace(/\s*\(npc\)$/i, ''), costumeName: item.costumeName === '???' ? '' : item.costumeName,
  icon: characterIcons[item.icon || id] || characterIcons.unknown, code: id, hasUltimate: Boolean(item.cutscene), hasDating: Boolean(item.dating), isNpc: /\(npc\)$/i.test(item.charName) || /^npc_/i.test(item.spine || ''),
  initials: item.charName.replace(/\s*\(Npc\)$/i, '').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
}))
const motions = [
  { name: 'Idle', detail: 'Default loop', icon: Activity },
  { name: 'Attack', detail: 'Combat sequence', icon: WandSparkles },
  { name: 'Skill', detail: 'Special ability', icon: Sparkles },
  { name: 'Victory', detail: 'End animation', icon: Clapperboard },
]
const filteredCharacters = computed(() => {
  const query = caseSensitive.value ? search.value.trim() : search.value.trim().toLocaleLowerCase()
  const filtered = characters.filter((item) => {
    const haystack = `${item.charName} ${item.costumeName} ${item.id}`
    const searchable = caseSensitive.value ? haystack : haystack.toLocaleLowerCase()
    const matchesSearch = !query || searchable.includes(query)
    const isNpc = item.isNpc
    const matchesFilters = !activeFilters.value.length || activeFilters.value.some((filter) => {
      if (filter === 'FG') return item.hasDating
      if (filter === 'U') return item.hasUltimate
      if (filter === 'PC') return !isNpc
      if (filter === 'NPC') return isNpc
      return true
    })
    return matchesSearch && matchesFilters
  })
  return filtered.sort((a, b) => {
    if (sortBy.value === 'name-desc') return b.charName.localeCompare(a.charName)
    if (sortBy.value === 'id-asc') return a.id.localeCompare(b.id, undefined, { numeric: true })
    if (sortBy.value === 'id-desc') return b.id.localeCompare(a.id, undefined, { numeric: true })
    return a.charName.localeCompare(b.charName)
  })
})
function setAudioLanguage(language) {
  audioLanguage.value = language === 'KR' ? 'KR' : 'JP'
  try { window.localStorage.setItem('browndust2-l2d-viewer-audio-language', audioLanguage.value) } catch { /* Storage may be unavailable. */ }
}
function openFilters() {
  pendingFilters.value = [...activeFilters.value]
  filtersOpen.value = !filtersOpen.value
}
function toggleFilter(filter) {
  pendingFilters.value = pendingFilters.value.includes(filter)
    ? pendingFilters.value.filter((item) => item !== filter)
    : [...pendingFilters.value, filter]
}
function applyFilters() {
  activeFilters.value = [...pendingFilters.value]
  filtersOpen.value = false
}
function resetFilters() {
  activeFilters.value = []
  pendingFilters.value = []
  search.value = ''
  caseSensitive.value = false
  sortBy.value = 'name-asc'
}
function chooseCharacter(item) {
  skinMenuOpen.value = false
  layerSearch.value = ''
  selectedCharacter.value = item.id
  datingAnimationSets.value = {}
  characterOpened.value = true
  activeSpineSet.value = 'character'
  activeCatalogMode.value = 'animations'
  loopPlayback.value = true
  availableAnimations.value = []
  selectedAnimation.value = ''
  availableSkins.value = []
  selectedSkin.value = ''
  importError.value = ''
}
function backToCharacters() {
  characterOpened.value = false
  activeSpineSet.value = 'character'
  availableAnimations.value = []
  selectedAnimation.value = ''
  availableSkins.value = []
  selectedSkin.value = ''
  importError.value = ''
}
function selectSpineSet(set) {
  skinMenuOpen.value = false
  if (set === 'ultimate' && !selectedCharacterData.value.cutscene) return
  if (set === 'dating' && !selectedCharacterData.value.dating) return
  if (activeSpineSet.value === set) return
  activeSpineSet.value = set
  if (set === 'dating') datingAnimationSets.value = {}
  activeCatalogMode.value = 'animations'
  loopPlayback.value = true
  availableAnimations.value = []
  selectedAnimation.value = ''
  availableSkins.value = []
  selectedSkin.value = ''
  importError.value = ''
}
function onFiles(event) {
  const files = Array.from(event.target.files || [])
  const atlas = files.find((file) => file.name.toLowerCase().endsWith('.atlas'))
  const skeleton = files.find((file) => /\.(skel|json)$/i.test(file.name))
  const textures = files.filter((file) => /\.(png|webp)$/i.test(file.name))
  if (!atlas || !skeleton || !textures.length) {
    importError.value = 'Нужны .atlas, .skel (или .json) и все текстуры .png/.webp.'
    return
  }
  importError.value = ''
  spineFiles.value = files
  importedFiles.value = files.map((file) => file.name)
  selectedAnimation.value = ''
}
function onAnimations(names) {
  if (activeSpineSet.value === 'dating' && multiDatingVariants.value.length > 1) {
    const variant = activeDatingVariant.value || multiDatingVariants.value[0]
    setDatingVariantAnimations(variant, names)
    return
  }
  const compositeNames = activeComposites.value.map((entry) => entry.name).filter(Boolean)
  availableAnimations.value = [...new Set([...names, ...compositeNames])]
  names = availableAnimations.value
  selectedAnimation.value = activeSpineSet.value === 'ultimate'
    ? names[0] || ''
    : activeSpineSet.value === 'dating'
      ? names.find((name) => /^mix\d+$/i.test(name)) || names.find((name) => /idle/i.test(name)) || names[0] || ''
      : names.find((name) => /idle/i.test(name)) || names[0] || ''
}
function setDatingVariantAnimations(variant, names) {
  datingAnimationSets.value = { ...datingAnimationSets.value, [variant]: [...new Set((names || []).filter(Boolean))] }
  availableAnimations.value = datingAnimationCatalog.value.map(item => item.key)
  const firstVariant = multiDatingVariants.value[0]
  if (!selectedAnimation.value && datingAnimationSets.value[firstVariant]?.length) {
    const firstNames = datingAnimationSets.value[firstVariant]
    const initial = firstNames.find(name => /^mix\d+$/i.test(name)) || firstNames.find(name => /idle/i.test(name)) || firstNames[0]
    selectedAnimation.value = `${firstVariant}::${initial}`
  }
}
function onDatingPreloadAnimations(names) {
  if (activeSpineSet.value !== 'dating' || !datingPreloadVariant.value) return
  setDatingVariantAnimations(datingPreloadVariant.value, names)
}
function onSkins(names, initialSkin = '') {
  const datingSkins = activeSpineSet.value === 'dating' ? [...new Set((names || []).filter(Boolean))] : []
  availableSkins.value = datingSkins.length > 1 ? datingSkins : []
  selectedSkin.value = availableSkins.value.includes(initialSkin)
    ? initialSkin
    : availableSkins.value[0] || ''
}
function onLayers(names) {
  availableLayers.value = [...new Set([...availableLayers.value, ...names])].sort((a, b) => a.localeCompare(b))
  const next = { ...layerVisibility.value }
  availableLayers.value.forEach((name) => { if (!(name in next)) next[name] = true })
  layerVisibility.value = next
}
function toggleLayer(name) {
  const visible = layerVisibility.value[name] === false
  layerVisibility.value = { ...layerVisibility.value, [name]: visible }
  spinePreviewRef.value.setLayerVisible(name, visible)
}
function setAllLayers(visible) {
  const next = { ...layerVisibility.value }
  availableLayers.value.forEach((name) => { next[name] = visible })
  layerVisibility.value = next
  spinePreviewRef.value?.setAllLayersVisible?.(visible, availableLayers.value)
}
function onSpineError(message) {
  importError.value = message
}
function selectRelativeAnimation(direction) {
  if (!availableAnimations.value.length) return
  const current = availableAnimations.value.indexOf(selectedAnimation.value)
  const next = current < 0 ? 0 : (current + direction + availableAnimations.value.length) % availableAnimations.value.length
  selectedAnimation.value = availableAnimations.value[next]
}
async function takeScreenshot() {
  if (!spinePreviewRef.value || isScreenshotting.value) return
  isScreenshotting.value = true
  try {
    await spinePreviewRef.value.saveScreenshot(transparentScreenshot.value)
  } catch (error) {
    console.error('Failed to save screenshot:', error)
  } finally {
    isScreenshotting.value = false
  }
}
async function exportAnimation(format) {
  if (!spinePreviewRef.value || !selectedAnimation.value || isExportingAnimation.value) return
  exportMenuOpen.value = false
  isExportingAnimation.value = true
  try {
    await spinePreviewRef.value.exportAnimation(format, transparentScreenshot.value)
  } catch (error) {
    console.error('Failed to export animation:', error)
  } finally {
    isExportingAnimation.value = false
  }
}
function handleExportMenuOutside(event) {
  if (filtersOpen.value && !filtersAreaRef.value?.contains(event.target)) filtersOpen.value = false
  if (!exportMenuRef.value?.contains(event.target)) exportMenuOpen.value = false
  if (!cameraMenuRef.value?.contains(event.target)) cameraMenuOpen.value = false
  if (!audioMenuRef.value?.contains(event.target)) audioMenuOpen.value = false
}
function cycleSpeed() {
  const speeds = [0.5, 1, 1.5, 2]
  playbackSpeed.value = speeds[(speeds.indexOf(playbackSpeed.value) + 1) % speeds.length]
}
function toggleFullscreen() {
  if (!document.fullscreenElement) stageRef.value?.requestFullscreen?.()
  else document.exitFullscreen?.()
}
function clearFullscreenHideTimer() {
  if (fullscreenHideTimer) window.clearTimeout(fullscreenHideTimer)
  fullscreenHideTimer = 0
}
function scheduleFullscreenControlsHide() {
  if (!isFullscreen.value) return
  fullscreenControlsHidden.value = false
  clearFullscreenHideTimer()
  fullscreenHideTimer = window.setTimeout(() => {
    fullscreenControlsHidden.value = true
    fullscreenHideTimer = 0
  }, 3000)
}
function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === stageRef.value
  fullscreenControlsHidden.value = false
  clearFullscreenHideTimer()
  document.removeEventListener('pointermove', scheduleFullscreenControlsHide)
  if (isFullscreen.value) {
    document.addEventListener('pointermove', scheduleFullscreenControlsHide, { passive: true })
    scheduleFullscreenControlsHide()
  }
}
function handleGlobalKeydown(event) {
  if (event.code !== 'Space' || activeTab.value !== 'viewer' || showImport.value) return
  const target = event.target
  if (target?.isContentEditable || target?.closest?.('input, textarea, select')) return
  event.preventDefault()
  playing.value = !playing.value
}
let seekingTimeline = false
function seekTimeline(event) {
  if (event.type === 'pointerdown') seekingTimeline = true
  else if (!seekingTimeline) return
  const rect = event.currentTarget.getBoundingClientRect()
  const progress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  playbackProgress.value = progress
  if (event.type === 'pointerdown') event.currentTarget.setPointerCapture?.(event.pointerId)
  spinePreviewRef.value?.seek?.(progress)
}
function endTimelineSeek() { seekingTimeline = false }
function updateTimelineHover(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  timelineHoverProgress.value = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
}
onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('pointerdown', handleExportMenuOutside)
  document.addEventListener('fullscreenchange', syncFullscreenState)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  document.removeEventListener('pointerdown', handleExportMenuOutside)
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  document.removeEventListener('pointermove', scheduleFullscreenControlsHide)
  clearFullscreenHideTimer()
})
</script>

<template>
  <div class="app-shell">
    <main class="main-content">
      <header class="topbar">
        <button class="topbar-brand" type="button" aria-label="Return to start" @click="returnToStart"><img class="topbar-brand-avatar" src="/justia-logo.webp" alt="" /><span class="topbar-brand-copy"><span class="topbar-brand-game">BROWN DUST 2</span><span class="topbar-brand-viewer">L2D VIEWER</span></span></button>
        <nav class="top-actions" aria-label="Community">
          <a class="topbar-action topbar-action-telegram" href="https://t.me/browndust_2" target="_blank" rel="noopener noreferrer" data-tooltip="Open Telegram channel" aria-label="Open Brown Dust 2 Telegram channel"><img class="topbar-brand-icon topbar-brand-icon-telegram" src="https://telegram.org/img/t_logo.png" alt="" /></a>
          <button class="topbar-action" type="button" data-tooltip="Open GitHub repository" aria-label="Open GitHub repository"><img class="topbar-brand-icon topbar-brand-icon-github" src="https://cdn.simpleicons.org/github/FFFFFF" alt="" /></button>
        </nav>
      </header>

      <section v-if="activeTab === 'viewer'" class="page viewer-page">
        <div class="viewer-heading">
          <div><div class="eyebrow">BROWN DUST II · CHARACTER LAB</div><h1>{{ selectedCharacterName }}<span class="heading-period">.</span></h1><p>{{ selectedCharacterData.costumeName ? selectedCharacterData.costumeName + " · " : "" }}{{ /^\d+$/.test(selectedCharacter) ? selectedCharacter + " · " : "" }}{{ activeSpineSet === 'character' ? 'Standard animations' : activeSpineSet === 'ultimate' ? 'Ultimate animation' : 'Fated Guest' }}</p></div>
          <div class="viewer-heading-actions"><span class="gallery-count">{{ characters.length }} CHARACTERS</span><button class="button-secondary" @click="showImport = true"><Plus :size="15" /> Import assets</button></div>
        </div>
        <div class="studio-layout">
          <aside class="catalog-panel">
            <div ref="filtersAreaRef" class="catalog-search-row"><div class="catalog-search catalog-search-compact"><Search :size="16" /><input v-model="search" placeholder="Search..." aria-label="Search characters" /><button v-if="search" class="clear-search" data-tooltip="Clear search" @click="search = ''"><X :size="14" /></button></div>
            <button class="catalog-filter-trigger" :class="{ active: filtersOpen || activeFilters.length }" aria-label="Open filters" :aria-expanded="filtersOpen" @click="openFilters"><SlidersHorizontal :size="15" /><span>Filters</span><i v-if="activeFilters.length">{{ activeFilters.length }}</i></button>
            
            <div v-if="filtersOpen" class="catalog-filter-popover">
              <div class="catalog-filter-popover-head"><strong>Filters & sorting</strong></div>
              <div class="filter-chips filter-chips-vertical">
                <button v-for="filter in [{ id: 'FG', label: 'Fated Guest' }, { id: 'U', label: 'Ultimate' }, { id: 'PC', label: 'Playable Characters' }, { id: 'NPC', label: 'NPCs' }]" :key="filter.id" class="filter-chip" :class="{ active: pendingFilters.includes(filter.id), ['filter-' + filter.id.toLowerCase()]: true }" :aria-pressed="activeFilters.includes(filter.id)" @click="toggleFilter(filter.id)"><span>{{ filter.id }}</span>{{ filter.label }}</button>
              </div>
              <div class="filter-popover-footer"><button class="filter-reset-button" :disabled="!activeFilters.length && !pendingFilters.length && !search && !caseSensitive && sortBy === 'name-asc'" @click="resetFilters"><RotateCcw :size="14" /><span>Reset</span></button><button class="filter-apply-button" @click="applyFilters">Apply filters</button></div>
            </div></div>
            <div class="catalog-list-heading"><span>CHARACTER LIST</span><span>{{ filteredCharacters.length }} ITEMS</span></div>
            <div class="catalog-character-list">
              <button v-for="item in filteredCharacters" :key="item.id" class="catalog-character" :class="{ selected: selectedCharacter === item.id }" @click="chooseCharacter(item)">
                <span class="catalog-avatar"><img :src="item.icon" :alt="`${item.displayName} icon`" loading="lazy" /></span><span class="catalog-character-info"><strong>{{ item.displayName }}</strong><small>{{ item.costumeName ? item.costumeName + (/^\\d+$/.test(item.id) ? " · " : "") : "" }}{{ /^\\d+$/.test(item.id) ? item.id : "" }}</small><span class="catalog-tags"><i v-if="item.hasDating" class="tag-fg">FG</i><i v-if="item.hasUltimate" class="tag-ultimate">U</i><i v-if="item.isNpc" class="tag-npc">NPC</i></span></span><span v-if="selectedCharacter === item.id" class="selected-dot"></span>
              </button>
              <div v-if="!filteredCharacters.length" class="gallery-empty">No characters found.</div>
            </div>
            <div class="catalog-animation-section">
              <div class="catalog-list-heading"><span>{{ activeCatalogMode === 'animations' ? 'ANIMATION SET' : 'LAYERS' }}</span><span>{{ activeCatalogMode === 'animations' ? availableAnimations.length + ' ANIMATIONS' : availableLayers.length + ' LAYERS' }}</span></div>
              <div class="catalog-category-row">
                <div class="catalog-category-list">
                  <button class="category-option set-standard" :class="{ selected: activeSpineSet === 'character' }" @click="activeCatalogMode = 'animations'; selectSpineSet('character')"><Activity :size="15" /><span>Standard</span><i v-if="activeSpineSet === 'character'"></i></button>
                  <button v-if="selectedCharacterData.cutscene" class="category-option set-ultimate" :class="{ selected: activeSpineSet === 'ultimate' }" @click="activeCatalogMode = 'animations'; selectSpineSet('ultimate')"><Film :size="15" /><span>Ultimate</span><i v-if="activeSpineSet === 'ultimate'"></i></button>
                  <button v-if="selectedCharacterData.dating" class="category-option set-fg" :class="{ selected: activeSpineSet === 'dating' }" @click="activeCatalogMode = 'animations'; selectSpineSet('dating')"><BookOpen :size="15" /><span>Fated Guest</span><i v-if="activeSpineSet === 'dating'"></i></button>
                </div>
                <button class="category-option layers-tab set-layers" :class="{ selected: activeCatalogMode === 'layers' }" :aria-pressed="activeCatalogMode === 'layers'" @click="activeCatalogMode = activeCatalogMode === 'layers' ? 'animations' : 'layers'"><Layers3 :size="16" /><span>Layers</span><i v-if="activeCatalogMode === 'layers'"></i></button>
              </div>
              <div v-if="activeCatalogMode === 'animations' && activeSpineSet === 'dating' && availableSkins.length > 1" class="skins-control">
                <div class="skins-control-heading"><span>SKINS</span></div>
                <div class="skins-select-wrap">
                  <button class="skins-select" type="button" aria-label="Choose model skin" :aria-expanded="skinMenuOpen" @click="skinMenuOpen = !skinMenuOpen">
                    <span>{{ selectedSkin || 'Select skin' }}</span><ChevronDown :size="15" class="skins-select-chevron" />
                  </button>
                  <div v-if="skinMenuOpen" class="skins-options" role="listbox" aria-label="Available skins">
                    <button v-for="skin in availableSkins" :key="skin" type="button" role="option" :aria-selected="selectedSkin === skin" :class="{ selected: selectedSkin === skin }" @click="selectedSkin = skin; skinMenuOpen = false">{{ skin }}</button>
                  </div>
                </div>
                
              </div>
              <div v-if="activeCatalogMode === 'animations'" class="catalog-animation-list">
                <button v-for="name in availableAnimations" :key="name" class="catalog-animation" :class="{ selected: selectedAnimation === name }" @click="selectedAnimation = name"><Activity :size="13" /><span>{{ datingAnimationCatalog.find(item => item.key === name)?.label || name }}</span><i v-if="selectedAnimation === name"></i></button>
                <div v-if="!availableAnimations.length" class="animation-empty">Loading animations…</div>
              </div>
              <div v-else class="catalog-layers-view">
                <div class="layers-search">
                  <Search :size="15" />
                  <input v-model="layerSearch" type="search" placeholder="Search layers..." aria-label="Search layers" />
                  <button v-if="layerSearch" type="button" class="layers-search-clear" aria-label="Clear layer search" @click="layerSearch = ''"><X :size="13" /></button>
                </div>
                <div class="layers-actions"><button @click="setAllLayers(true)">Show all</button><button @click="setAllLayers(false)">Hide all</button></div>
                <div v-if="availableLayers.length" class="layers-list">
                  <label v-for="name in filteredLayers" :key="name" class="layer-item">
                    <input type="checkbox" :checked="layerVisibility[name] !== false" @change="toggleLayer(name)" />
                    <span>{{ name }}</span><span class="layer-visibility-indicator" :class="{ hidden: layerVisibility[name] === false }" :aria-label="layerVisibility[name] === false ? 'Hidden' : 'Visible'"><Eye v-if="layerVisibility[name] !== false" :size="13" /><EyeOff v-else :size="13" /></span>
                  </label>
                  <div v-if="!filteredLayers.length" class="animation-empty">No matching layers.</div>
                </div>
                <div v-else class="animation-empty">Layers appear after the Spine model loads.</div>
              </div>
            </div>
          </aside>
          <section ref="stageRef" class="stage-panel" :class="{ 'controls-hidden': isFullscreen && fullscreenControlsHidden }">
            <div class="panel-topline"><div class="panel-label"><span class="live-indicator"></span> {{ activeCostumeTitle }} <span class="muted-tag" :class="activeSpineSet === 'character' ? 'tag-standard' : activeSpineSet === 'ultimate' ? 'tag-ultimate' : 'tag-fg'">{{ activeSpineSet === 'character' ? 'STANDART' : activeSpineSet === 'ultimate' ? 'ULTIMATE' : 'FATED GUEST' }}</span></div><div class="stage-actions"><span class="zoom-readout">{{ previewScale }}%</span><button class="icon-button" data-tooltip="Reset position and zoom" aria-label="Reset position and zoom" @click="spinePreviewRef?.resetView?.()"><RotateCcw :size="15" /></button><button class="icon-button" aria-label="Zoom out" @click="spinePreviewRef?.zoomOut?.()"><Minus :size="15" /></button><button class="icon-button" aria-label="Zoom in" @click="spinePreviewRef?.zoomIn?.()"><Plus :size="15" /></button></div></div>
            <div class="stage stage-large" :class="selectedCharacterName.toLowerCase()" >
              <div class="stage-grid"></div><div class="orb orb-one"></div><div class="orb orb-two"></div>
              <div class="stage-watermark"><Sparkles :size="15" /> BROWNDUST2 L2D VIEWER</div>
              <SpinePreview ref="spinePreviewRef" :files="spineFiles" :asset-base="activeAssetBase" :animation="previewAnimation" :skin="selectedSkin" :composites="activeComposites" :dating-tracks="activeSpineSet === 'dating' && selectedCharacterData.datingUsesTracks" :playing="playing" :loop="loopPlayback" :scale="previewScale" :speed="playbackSpeed" :use-current-camera="useCurrentCameraForExport" :audio-base="activeSpineSet === 'character' ? selectedAudioBase : ''" @animations="onAnimations" @skins="onSkins" @layers="onLayers" @error="onSpineError" @progress="playbackProgress = $event" @duration="animationDuration = $event" @zoom="previewScale = $event" />
              <div v-if="activeSpineSet === 'dating' && datingPreloadAssetBase" style="position:fixed;left:-10000px;top:0;width:640px;height:480px;opacity:0;pointer-events:none;z-index:-1" aria-hidden="true">
                <SpinePreview :asset-base="datingPreloadAssetBase" animation="" :dating-tracks="true" :playing="false" :loop="true" :scale="100" :speed="1" @animations="onDatingPreloadAnimations" />
              </div>
              <div v-if="importError" class="spine-error">{{ importError }}</div>
              <div v-if="!activeAssetBase && !spineFiles.length" class="stage-placeholder"><div class="placeholder-emblem"><Image :size="31" /></div><div class="placeholder-title">{{ selectedCharacterName }}</div><div class="placeholder-subtitle">CHARACTER PREVIEW</div><div class="placeholder-rule"></div><p>Animation preview will appear here<br />when a compatible asset is loaded.</p><button class="button-primary small" @click="showImport = true"><Plus :size="15" /> Add character files</button></div>
              
            </div>
            <div class="player-bar">
              <div class="player-controls"><button class="icon-button" aria-label="Previous animation" @click="selectRelativeAnimation(-1)" :disabled="!availableAnimations.length"><ChevronLeft :size="17" /></button><button class="play-button" aria-label="Play or pause" @click="playing = !playing"><Pause v-if="playing" :size="17" /><Play v-else :size="17" /></button><button class="icon-button" aria-label="Next animation" @click="selectRelativeAnimation(1)" :disabled="!availableAnimations.length"><ChevronRight :size="17" /></button><span class="timecode">{{ previewAnimation || 'No animation selected' }}</span></div>
              <div class="timeline-group"><div class="timeline timeline-seek" :style="{ '--timeline-hover-x': (timelineHoverProgress * 100) + '%' }" role="slider" aria-label="Seek animation" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(playbackProgress * 100)" @pointerdown="seekTimeline" @pointermove="seekTimeline" @pointerup="endTimelineSeek" @pointercancel="endTimelineSeek" @lostpointercapture="endTimelineSeek" @mousemove="updateTimelineHover" @mouseleave="timelineHoverProgress = 0"><span class="timeline-played" :style="{ width: (playbackProgress * 100) + '%' }"></span><span class="timeline-hover" :style="{ width: (timelineHoverProgress * 100) + '%' }"></span></div><span class="timeline-time">{{ formatTime(playbackProgress * animationDuration) }} / {{ formatTime(animationDuration) }}</span></div>
              <div class="player-options"><div ref="audioMenuRef" class="player-menu-wrap audio-menu-wrap"><button type="button" class="icon-button export-icon-button player-menu-trigger" :class="{ active: audioMenuOpen }" data-tooltip="Voice language" aria-label="Voice language" :aria-expanded="audioMenuOpen" @click="audioMenuOpen = !audioMenuOpen"><Volume2 :size="17" /></button><div v-if="audioMenuOpen" class="player-menu-popover audio-menu-popover"><button type="button" :class="{ selected: audioLanguage === 'JP' }" :aria-pressed="audioLanguage === 'JP'" @click="setAudioLanguage('JP'); audioMenuOpen = false">JP <span>{{ audioLanguage === 'JP' ? 'Selected' : '' }}</span></button><button type="button" :class="{ selected: audioLanguage === 'KR' }" :aria-pressed="audioLanguage === 'KR'" @click="setAudioLanguage('KR'); audioMenuOpen = false">KR <span>{{ audioLanguage === 'KR' ? 'Selected' : '' }}</span></button></div></div><button v-if="isFullscreen" class="icon-button fullscreen-reset-button" data-tooltip="Reset position and zoom" aria-label="Reset position and zoom" @click="spinePreviewRef?.resetView?.()"><RotateCcw :size="15" /></button><button class="speed-button" data-tooltip="Playback speed" aria-label="Playback speed" @click="cycleSpeed">{{ playbackSpeed }}×</button><button class="icon-button export-icon-button screenshot-button" data-tooltip="Save screenshot" aria-label="Save screenshot" :disabled="isScreenshotting" @click="takeScreenshot"><Camera :size="17" /></button><div ref="cameraMenuRef" class="player-menu-wrap settings-menu-wrap"><button type="button" class="icon-button export-icon-button player-menu-trigger" :class="{ active: cameraMenuOpen }" data-tooltip="Screenshot settings" aria-label="Screenshot settings" :aria-expanded="cameraMenuOpen" @click="cameraMenuOpen = !cameraMenuOpen"><Settings2 :size="17" /></button><div v-if="cameraMenuOpen" class="player-menu-popover settings-menu-popover"><button type="button" :class="{ selected: transparentScreenshot }" :aria-pressed="transparentScreenshot" @click="transparentScreenshot = !transparentScreenshot">Transparent background <span>{{ transparentScreenshot ? 'On' : 'Off' }}</span></button><button type="button" :class="{ selected: useCurrentCameraForExport }" :aria-pressed="useCurrentCameraForExport" @click="useCurrentCameraForExport = !useCurrentCameraForExport">Use current camera <span>{{ useCurrentCameraForExport ? 'On' : 'Off' }}</span></button></div></div><div ref="exportMenuRef" class="export-menu-wrap"><button class="icon-button export-icon-button animation-export-button" :class="{ active: exportMenuOpen }" :data-tooltip="isExportingAnimation ? 'Exporting animation' : 'Export animation'" aria-label="Export animation" :aria-expanded="exportMenuOpen" :disabled="isExportingAnimation || !selectedAnimation" @click="exportMenuOpen = !exportMenuOpen"><Download :size="16" /></button><div v-if="exportMenuOpen" class="export-menu-popover"><button type="button" @click="exportAnimation('frames')">Export frames (ZIP)</button><button type="button" @click="exportAnimation('webm')">Export WebM</button><button type="button" @click="exportAnimation('gif')">Export GIF</button></div></div><button class="icon-button fullscreen-toggle-button" :data-tooltip="isFullscreen ? 'Exit Full Screen' : 'Full Screen'" :aria-label="isFullscreen ? 'Exit Full Screen' : 'Full Screen'" @click="toggleFullscreen"><Minimize2 v-if="isFullscreen" :size="16" /><Expand v-else :size="16" /></button></div>
            </div>
          </section>
        </div>
      </section>

      <section v-else class="page simple-page">
        <div class="page-heading"><div><div class="eyebrow">BROWNDUST2 L2D VIEWER</div><h1>{{ activeTab === 'library' ? 'Asset library' : 'Collections' }}<span class="heading-period">.</span></h1><p>This workspace is ready for your character and animation assets.</p></div><button class="button-secondary" @click="showImport = true"><CloudUpload :size="16" /> Import assets</button></div>
        <div class="empty-state-large"><div class="empty-icon"><BookOpen :size="23" /></div><h2>Your {{ activeTab === 'library' ? 'library' : 'collections' }} starts here</h2><p>Import compatible files and they will appear in this workspace.</p><button class="button-primary" @click="showImport = true"><Plus :size="16" /> Import assets</button></div>
      </section>
    </main>

    <div v-if="showImport" class="modal-backdrop" @click.self="showImport = false">
      <div class="import-modal"><div class="modal-heading"><div><div class="eyebrow">ASSET MANAGER</div><h2>Import character files</h2></div><button class="icon-button" @click="showImport = false"><X :size="18" /></button></div>
        <label class="drop-zone"><input type="file" multiple accept=".skel,.json,.atlas,.png,.webp" @change="onFiles" /><span class="upload-icon"><CloudUpload :size="23" /></span><strong>Choose files to import</strong><small>Drop files here or browse your device</small><em>Выбери .atlas, .skel/.json и все связанные .png/.webp текстуры.</em></label>
        <p v-if="importError" class="import-error">{{ importError }}</p>
        <div class="modal-footer"><span>{{ spineFiles.length ? 'Файлы готовы к просмотру' : 'Выбери комплект Spine-файлов' }}</span><button class="button-primary" @click="showImport = false">Done <ChevronRight :size="15" /></button></div>
      </div>
    </div>
  </div>
</template>