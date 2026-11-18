<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import SpinePreview from './components/SpinePreview.vue'
import characterRegistry from './src/data/character-list.json'
import characterIcons from './src/utils/charIcons.js'
import cutsceneMappings from './src/data/cutscene-mappings.json'
import illustSpecialRegistry from './src/data/illust-special-list.json'

const accessoryRegistry = [
  { id: '1006', asset: 'avatarbodyaccessory_1006' },
  { id: '1007', asset: 'avatarbodyaccessory_1007' },
  { id: '1013', asset: 'avatarbodyaccessory_1013' },
  { id: '1014', asset: 'avatarbodyaccessory_1014' },
]
import {
  Activity, AudioLines, Languages, BookOpen, Camera, ChevronDown, ChevronLeft, ChevronRight,
  Clapperboard, CloudUpload, Command, Download, Expand,
  Eye, EyeOff, Film, FolderOpen, Gem, Heart, FileText, Image, Layers3, Minimize2, Minus,
  Pause, Play, Plus, RotateCcw, Search, Settings2, SlidersHorizontal,
  Sparkles, TicketPercent, Volume2, WandSparkles, X
} from 'lucide-vue-next'

const uiRu = {
'Return to start':'На главную','Changelog':'Список изменений','Open changelog':'Открыть список изменений','Change language':'Сменить язык','Choose interface language':'Выбрать язык интерфейса','Interface language':'ЯЗЫК ИНТЕРФЕЙСА','Open Telegram channel':'Открыть Telegram-канал','Open Brown Dust 2 Telegram channel':'Открыть Telegram-канал Brown Dust 2','Open GitHub repository':'Открыть репозиторий GitHub','Coupon codes':'Промокоды','Open coupon center':'Открыть список промокодов','COUPON CENTER':'ЦЕНТР ПРОМОКОДОВ','Enter your in-game nickname':'Введите игровой ник','CLAIM ALL':'АКТИВИРОВАТЬ ВСЕ','3 Draw Tickets':'3 билета призыва','Expires':'Действует до','Not claimed':'Не активирован','Claimed':'Активирован','Already claimed':'Уже активирован','Expired':'Истёк срок действия','Invalid code':'Недействительный промокод','Nickname not found':'Никнейм не найден','Usage limit reached':'Лимит активаций исчерпан','Connection error':'Ошибка соединения','Claiming...':'Активация...','Enter your nickname to continue':'Введите игровой ник, чтобы продолжить','Rewards are sent to your in-game mailbox.':'Награды отправляются во внутриигровую почту.',
'Import assets':'Импортировать ассеты','Filters':'Фильтры','Filters & sorting':'Фильтры и сортировка','Fated Guest':'Судьбоносный гость','Ultimate':'Ультимейт','Playable Characters':'Игровые персонажи','NPCs':'NPC','Special Illustrations':'Специальные иллюстрации','Accessories':'Аксессуары','Accessory':'Accessory','Accessories · Spine animation':'Аксессуары · Spine-анимация','ACCESSORIES':'АКСЕССУАРЫ','ACCESSORY LAB':'ЛАБОРАТОРИЯ АКСЕССУАРОВ','CATALOG':'КАТАЛОГ','No accessories found.':'Аксессуары не найдены.','No matching items.':'Подходящие элементы не найдены.','Reset':'Сбросить','Apply filters':'Применить фильтры','CHARACTER LIST':'СПИСОК ПЕРСОНАЖЕЙ','ANIMATION SET':'НАБОР АНИМАЦИЙ','LAYERS':'СЛОИ','Standard':'Стандарт','SKINS':'СКИНЫ','Select skin':'Выбрать скин','Loading animations…':'Загрузка анимаций…','Search layers...':'Поиск слоёв...','Show all':'Показать все','Hide all':'Скрыть все','No characters found.':'Персонажи не найдены.','No illustrations found.':'Иллюстрации не найдены.','No matching layers.':'Подходящие слои не найдены.','Layers appear after the Spine model loads.':'Слои появятся после загрузки Spine-модели.',
'CHARACTER PREVIEW':'ПРЕДПРОСМОТР ПЕРСОНАЖА','Animation preview will appear here':'Здесь будет отображаться анимация','when a compatible asset is loaded.':'после загрузки совместимых ассетов.','Add character files':'Добавить файлы персонажа','Previous animation':'Предыдущая анимация','Play or pause':'Воспроизвести или приостановить','Next animation':'Следующая анимация','No animation selected':'Анимация не выбрана','Seek animation':'Перемотка анимации','Voice language':'Язык озвучки','Selected':'Выбрано','Playback speed':'Скорость воспроизведения','Save screenshot':'Сохранить скриншот','Screenshot settings':'Настройки скриншота','Transparent background':'Прозрачный фон','On':'Вкл.','Off':'Выкл.','Use current camera':'Использовать текущее положение камеры','Export animation':'Экспортировать анимацию','Export frames (ZIP)':'Экспорт кадров (ZIP)','Export WebM':'Экспорт WebM','Export GIF':'Экспорт GIF','Full Screen':'Полноэкранный режим','Exit Full Screen':'Выйти из полноэкранного режима','Asset library':'Библиотека ассетов','Collections':'Коллекции','Import character files':'Импорт файлов персонажа','Choose files to import':'Выбрать файлы для импорта','Drop files here or browse your device':'Перетащите файлы сюда или выберите их на устройстве','Done':'Готово','Close changelog':'Закрыть список изменений','Search...':'Поиск...','Search illustrations...':'Поиск иллюстраций...','Search characters':'Поиск персонажей','Search illustrations':'Поиск иллюстраций','Open filters':'Открыть фильтры','NPCs':'Неигровые персонажи','ITEMS':'ЭЛЕМЕНТОВ','ANIMATIONS':'АНИМАЦИЙ','NEW':'НОВОЕ','Layers':'Слои','Characters':'Персонажи','Animations':'Анимации','Clear search':'Очистить поиск','Search layers...':'Поиск слоёв...','Search layers':'Поиск слоёв','Clear layer search':'Очистить поиск слоёв','Choose model skin':'Выбрать скин модели','Available skins':'Доступные скины','Add character files':'Добавить файлы персонажа','Transparent background':'Прозрачный фон','Use current camera':'Использовать текущее положение камеры','Reset position and zoom':'Сбросить положение и масштаб','Exporting animation':'Экспорт анимации…','ILLUSTRATION LAB':'ЛАБОРАТОРИЯ ИЛЛЮСТРАЦИЙ','CHARACTER LAB':'ЛАБОРАТОРИЯ ПЕРСОНАЖЕЙ','Special illustrations · Spine animation':'Специальные иллюстрации · Spine-анимация','Standard animations':'Стандартные анимации','Ultimate animation':'Анимация ультимейта','ILLUSTRATIONS':'ИЛЛЮСТРАЦИЙ','CHARACTERS':'ПЕРСОНАЖЕЙ','ASSET MANAGER':'УПРАВЛЕНИЕ АССЕТАМИ','Select the .atlas, .skel/.json file and all associated .png/.webp textures.':'Выберите .atlas, .skel/.json и все связанные текстуры .png/.webp.','Files are ready to preview':'Файлы готовы к просмотру','Select a complete set of Spine files':'Выберите полный комплект Spine-файлов','All special illustrations have been added and are now available under the Filters section.':'Добавлены все специальные иллюстрации — теперь они доступны в разделе «Фильтры».','Added animations and cutscenes for Night of Betrayal Valze.':'Добавлены анимации и кат-сцены Night of Betrayal Valze.','Added animations and cutscenes for Liatris Sweet Temptation special skin.':'Добавлены анимации и кат-сцены специального костюма Liatris Sweet Temptation.','Various UI improvements and minor bug fixes.':'Улучшения интерфейса и небольшие исправления.',
'Added support for accessory animations and a dedicated Accessories category.':'Добавлена поддержка анимаций аксессуаров и отдельная категория Accessories.','Completely redesigned layer display and visibility controls.':'Полностью переработана система отображения слоёв и управления их видимостью.','Introduced a fully responsive mobile version with touch gestures, streamlined navigation, and a dedicated fullscreen mode.':'Добавлена полноценная мобильная версия с адаптированным интерфейсом, управлением жестами, удобной навигацией и полноэкранным режимом.','Added a coupon center for redeeming available codes, including one-click activation of all listed coupons.':'Добавлен центр активации промокодов с возможностью активировать все доступные коды одним нажатием.','Added Russian interface localization.':'Добавлена русская локализация интерфейса.','Improved the interface, filters, navigation, and animation browsing experience.':'Улучшены интерфейс, фильтры, навигация и просмотр анимаций.','Show':'Показать','Hide':'Скрыть','Zoom out':'Уменьшить масштаб','Zoom in':'Увеличить масштаб','This workspace is ready for your character and animation assets.':'Здесь будут храниться ассеты персонажей и анимаций.','Your library starts here':'Ваша библиотека начинается здесь','Your collections starts here':'Ваши коллекции начинаются здесь','Import compatible files and they will appear in this workspace.':'Импортируйте совместимые файлы — они появятся здесь.'
};
const locale = ref((() => { try { return window.localStorage.getItem('browndust2-l2d-viewer-locale') === 'ru' ? 'ru' : 'en' } catch { return 'en' } })());
const t = (key) => key === 'Interface language' ? (locale.value === 'ru' ? (uiRu[key] || 'ЯЗЫК ИНТЕРФЕЙСА') : 'INTERFACE LANGUAGE') : locale.value === 'ru' ? (uiRu[key] || key) : key;
const russianCountForms = {
  ITEMS: ['ЭЛЕМЕНТ', 'ЭЛЕМЕНТА', 'ЭЛЕМЕНТОВ'],
  ANIMATIONS: ['АНИМАЦИЯ', 'АНИМАЦИИ', 'АНИМАЦИЙ'],
  LAYERS: ['СЛОЙ', 'СЛОЯ', 'СЛОЁВ'],
  ILLUSTRATIONS: ['ИЛЛЮСТРАЦИЯ', 'ИЛЛЮСТРАЦИИ', 'ИЛЛЮСТРАЦИЙ'],
  CHARACTERS: ['ПЕРСОНАЖ', 'ПЕРСОНАЖА', 'ПЕРСОНАЖЕЙ'],
};
function countLabel(count, key) {
  if (locale.value !== 'ru') return `${count} ${t(key)}`;
  const value = Math.abs(Number(count)) % 100;
  const lastDigit = value % 10;
  const form = value > 10 && value < 20 ? 2 : lastDigit === 1 ? 0 : lastDigit >= 2 && lastDigit <= 4 ? 1 : 2;
  return `${count} ${russianCountForms[key]?.[form] || t(key)}`;
}
provide('appLocale', locale);
const languageMenuOpen = ref(false);
const languageMenuRef = ref(null);
const desktopLanguageMenuRef = ref(null);
function setLocale(value) { locale.value = value === 'ru' ? 'ru' : 'en'; document.documentElement.lang = locale.value; try { window.localStorage.setItem('browndust2-l2d-viewer-locale', locale.value) } catch {  } languageMenuOpen.value = false; }

const activeTab = ref('viewer')
const mobilePanel = ref('')
const changelogOpen = ref(false)
const couponModalOpen = ref(false)
const couponClaiming = ref(false)
const couponNicknameStorageKey = 'browndust2-l2d-viewer-coupon-nickname'
const couponResultsStorageKey = 'browndust2-l2d-viewer-coupon-results'
const couponNickname = ref((() => { try { return window.localStorage.getItem(couponNicknameStorageKey) || '' } catch { return '' } })())
const couponResultStore = ref((() => { try { const value = JSON.parse(window.localStorage.getItem(couponResultsStorageKey) || '{}'); return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, result]) => [key, result?.status === 'success' ? { ...result, status: 'already' } : result])) : {} } catch { return {} } })())
const couponList = [
  { code: 'BD2RADIOMINE', reward: '3 Draw Tickets', rewardRu: '3 Draw Tickets', expires: '30/11/2026' },
  { code: '2026BD2NOV', reward: '3 Draw Tickets', rewardRu: '3 Draw Tickets', expires: '30/11/2026' },
  { code: 'BD2RADIOWOLF', reward: '3 Draw Tickets', rewardRu: '3 Draw Tickets', expires: '31/12/2026' },
  { code: 'COFFEEWITHMASTER', reward: 'Dias x600', rewardRu: 'Dias x600', expires: 'Permanent', expiresRu: 'Бессрочный' },
  { code: 'BD22026SUMMER', reward: 'Refining Powder x100k', rewardRu: 'Refining Powder x100k', expires: 'Permanent', expiresRu: 'Бессрочный' },
  { code: 'SQUARE1000DEKO', reward: 'Deco Coin x1000', rewardRu: 'Deco Coin x1000', expires: 'Permanent', expiresRu: 'Бессрочный' },
  { code: 'BD2025SUMMER', reward: '5* Contract x1', rewardRu: '5* Contract x1', expires: 'Permanent', expiresRu: 'Бессрочный' },
  { code: 'Waiting4legend', reward: 'Venomous Touch III x1', rewardRu: 'Venomous Touch III x1', expires: 'Permanent', expiresRu: 'Бессрочный' },
]
const couponRedeemApi = 'https://bd2-coupon-proxy.bd2viewer.workers.dev/'
function couponResultKey(nickname, code) { return `${nickname.trim().toLocaleLowerCase()}::${code}` }
function couponStatus(code) { return couponResultStore.value[couponResultKey(couponNickname.value, code)]?.status || '' }
function couponStatusLabel(code) {
  const labels = { success: 'Claimed', already: 'Already claimed', expired: 'Expired', invalid: 'Invalid code', nickname: 'Nickname not found', limit: 'Usage limit reached', network: 'Connection error', claiming: 'Claiming...' }
  const status = couponStatus(code)
  return t(labels[status] || 'Not claimed')
}
function saveCouponNickname() {
  try { window.localStorage.setItem(couponNicknameStorageKey, couponNickname.value.trim()) } catch {  }
}
function saveCouponResult(nickname, code, status) {
  couponResultStore.value = { ...couponResultStore.value, [couponResultKey(nickname, code)]: { status } }
  try { window.localStorage.setItem(couponResultsStorageKey, JSON.stringify(couponResultStore.value)) } catch {  }
}
function getCouponResultStatus(response) {
  if (response?.success === true) return 'success'
  const error = String(response?.error || response?.code || response?.message || '').toLowerCase()
  if (error.includes('alreadyused') || error.includes('already_used')) return 'already'
  if (error.includes('expired')) return 'expired'
  if (error.includes('incorrectuser') || error.includes('nickname')) return 'nickname'
  if (error.includes('exceededuses') || error.includes('limit')) return 'limit'
  if (error.includes('invalidcode') || error.includes('validationfailed') || error.includes('unavailablecode')) return 'invalid'
  return 'network'
}
async function claimAllCoupons() {
  const nickname = couponNickname.value.trim()
  if (!nickname || couponClaiming.value) return
  saveCouponNickname()
  couponClaiming.value = true
  try {
    for (let index = 0; index < couponList.length; index += 1) {
      const coupon = couponList[index]
      const previous = couponResultStore.value[couponResultKey(nickname, coupon.code)]?.status
      if (previous === 'success' || previous === 'already') continue
      saveCouponResult(nickname, coupon.code, 'claiming')
      try {
        const response = await fetch(couponRedeemApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: 'bd2-live', userId: nickname, code: coupon.code }),
        })
        const raw = await response.text()
        let payload = {}
        try { payload = raw ? JSON.parse(raw) : {} } catch { payload = { error: raw } }
        if (!response.ok && !payload.error) payload.error = `HTTP_${response.status}`
        saveCouponResult(nickname, coupon.code, getCouponResultStatus(payload))
      } catch (error) {
        console.error('Coupon redemption failed:', error)
        saveCouponResult(nickname, coupon.code, 'network')
      }
      if (index < couponList.length - 1) await new Promise(resolve => window.setTimeout(resolve, 900))
    }
  } finally {
    const updatedResults = { ...couponResultStore.value }
    for (const coupon of couponList) {
      const key = couponResultKey(nickname, coupon.code)
      if (updatedResults[key]?.status === 'success') {
        updatedResults[key] = { ...updatedResults[key], status: 'already' }
      }
    }
    couponResultStore.value = updatedResults
    try { window.localStorage.setItem(couponResultsStorageKey, JSON.stringify(updatedResults)) } catch {  }
    couponClaiming.value = false
  }
}
const assetBaseUrl = import.meta.env.VITE_ASSET_BASE_URL || import.meta.env.BASE_URL
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
const selectedCharacter = ref('068001')
const characterOpened = ref(false)
const activeSpineSet = ref('character')
const datingAnimationSets = ref({})
const selectedIllustration = ref(illustSpecialRegistry[0]?.id || '')
const selectedIllustrationData = computed(() => illustSpecialRegistry.find(item => item.id === selectedIllustration.value) || illustSpecialRegistry[0] || null)
const selectedAccessory = ref(accessoryRegistry[0]?.id || '')
const selectedAccessoryData = computed(() => accessoryRegistry.find(item => item.id === selectedAccessory.value) || accessoryRegistry[0] || null)
const selectedCharacterData = computed(() => characterRegistry[selectedCharacter.value] || characterRegistry['000101'])
const selectedCharacterName = computed(() => activeSpineSet.value === 'illustration' ? (selectedIllustrationData.value?.label || 'Special Illustrations') : activeSpineSet.value === 'accessories' ? `${t('Accessory')} ${selectedAccessoryData.value?.id || ''}`.trim() : selectedCharacterData.value.charName)
const activeCostumeTitle = computed(() => activeSpineSet.value === 'illustration' ? (selectedIllustrationData.value?.label || 'Special Illustrations') : activeSpineSet.value === 'accessories' ? `${t('Accessory')} ${selectedAccessoryData.value?.id || ''}`.trim() : [selectedCharacterData.value.costumeName, selectedCharacterData.value.charName.replace(/\s*\(npc\)$/i, '')].filter(Boolean).join(' '))
const timelineHoverProgress = ref(0)
const activeComposites = computed(() => activeSpineSet.value === 'ultimate' ? (cutsceneMappings[selectedCharacter.value] || []) : [])
const characterAssetRoot = computed(() => {
  const character = selectedCharacterData.value
  const folderName = getCharacterFolderName(character, selectedCharacter.value)
  return `${assetBaseUrl}${selectedCharacter.value}/${folderName}/`
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
  if (activeSpineSet.value === 'accessories') {
    const item = selectedAccessoryData.value
    return item ? `${assetBaseUrl}avatarbodyaccessory/${item.asset}` : ''
  }
  if (activeSpineSet.value === 'illustration') {
    const item = selectedIllustrationData.value
    return item ? `${assetBaseUrl}illust_special/${item.folder}/${item.asset}` : ''
  }
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
  return `${assetBaseUrl}${selectedCharacter.value}/${folderName}/${audioLanguage.value}/${character.audio}`
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
const fullscreenFallback = ref(false)
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
  const characterFilters = activeFilters.value.filter((filter) => ['FG', 'U', 'PC', 'NPC'].includes(filter))
  const filtered = characters.filter((item) => {
    const haystack = `${item.charName} ${item.costumeName} ${item.id}`
    const searchable = caseSensitive.value ? haystack : haystack.toLocaleLowerCase()
    const matchesSearch = !query || searchable.includes(query)
    const isNpc = item.isNpc
    const matchesFilters = activeFilters.value.length === 0 || characterFilters.some((filter) => {
      if (filter === 'FG') return item.hasDating
      if (filter === 'U') return item.hasUltimate
      if (filter === 'PC') return !isNpc
      if (filter === 'NPC') return isNpc
      return false
    })
    return matchesSearch && matchesFilters
  })
  return filtered.sort((a, b) => {
    const priority = ['068001', '001297']
    const priorityDifference = priority.indexOf(a.id) - priority.indexOf(b.id)
    if (priorityDifference !== 0 && (priority.includes(a.id) || priority.includes(b.id))) {
      return priority.indexOf(a.id) === -1 ? 1 : priority.indexOf(b.id) === -1 ? -1 : priorityDifference
    }
    if (sortBy.value === 'name-desc') return b.charName.localeCompare(a.charName)
    if (sortBy.value === 'id-asc') return a.id.localeCompare(b.id, undefined, { numeric: true })
    if (sortBy.value === 'id-desc') return b.id.localeCompare(a.id, undefined, { numeric: true })
    return a.charName.localeCompare(b.charName)
  })
})
const filteredIllustrations = computed(() => {
  const query = caseSensitive.value ? search.value.trim() : search.value.trim().toLocaleLowerCase()
  return illustSpecialRegistry.filter(item => {
    const value = `${item.label} ${item.id}`
    return !query || (caseSensitive.value ? value : value.toLocaleLowerCase()).includes(query)
  }).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))
})
const filteredAccessories = computed(() => {
  const query = caseSensitive.value ? search.value.trim() : search.value.trim().toLocaleLowerCase()
  return accessoryRegistry.filter(item => {
    const value = `${t('Accessory')} ${item.id} ${item.asset}`
    return !query || (caseSensitive.value ? value : value.toLocaleLowerCase()).includes(query)
  }).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
})
const filteredCatalogItems = computed(() => {
  if (!activeFilters.value.length) return filteredCharacters.value.map(item => ({ type: 'character', item }))
  const entries = []
  if (activeFilters.value.some(filter => ['FG', 'U', 'PC', 'NPC'].includes(filter))) {
    entries.push(...filteredCharacters.value.map(item => ({ type: 'character', item })))
  }
  if (activeFilters.value.includes('AC')) entries.push(...filteredAccessories.value.map(item => ({ type: 'accessory', item })))
  if (activeFilters.value.includes('SI')) entries.push(...filteredIllustrations.value.map(item => ({ type: 'illustration', item })))
  return entries
})
const catalogHeading = computed(() => {
  const filters = activeFilters.value
  if (!filters.length) return t('CHARACTER LIST')
  const hasCharacters = filters.some(filter => ['FG', 'U', 'PC', 'NPC'].includes(filter))
  const categoryCount = [hasCharacters, filters.includes('AC'), filters.includes('SI')].filter(Boolean).length
  if (categoryCount > 1) return t('CATALOG')
  if (filters.includes('AC')) return t('ACCESSORIES')
  if (filters.includes('SI')) return t('Special Illustrations').toUpperCase()
  if (filters.includes('NPC') && !filters.includes('PC')) return t('NPCs').toUpperCase()
  if (filters.includes('PC') && !filters.includes('NPC')) return t('Playable Characters').toUpperCase()
  if (filters.includes('FG')) return t('Fated Guest').toUpperCase()
  if (filters.includes('U')) return t('Ultimate').toUpperCase()
  return t('CHARACTER LIST')
})
function setAudioLanguage(language) {
  audioLanguage.value = language === 'KR' ? 'KR' : 'JP'
  try { window.localStorage.setItem('browndust2-l2d-viewer-audio-language', audioLanguage.value) } catch {  }
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
function toggleCatalogFilter(filter) {
  toggleFilter(filter)
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
  filtersOpen.value = false
}
function chooseCharacter(item) {
  mobilePanel.value = ''
  skinMenuOpen.value = false
  layerSearch.value = ''
  availableLayers.value = []
  layerVisibility.value = {}
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
  availableLayers.value = []
  layerVisibility.value = {}
  activeSpineSet.value = 'character'
  availableAnimations.value = []
  selectedAnimation.value = ''
  availableSkins.value = []
  selectedSkin.value = ''
  importError.value = ''
}
function selectAccessory(item) {
  mobilePanel.value = ''
  const changed = selectedAccessory.value !== item.id || activeSpineSet.value !== 'accessories'
  selectedAccessory.value = item.id
  if (!changed) return
  if (activeSpineSet.value !== 'accessories') {
    selectSpineSet('accessories')
    return
  }
  availableAnimations.value = []
  selectedAnimation.value = ''
  availableSkins.value = []
  selectedSkin.value = ''
  availableLayers.value = []
  layerVisibility.value = {}
  importError.value = ''
}
function selectIllustration(item) {
  mobilePanel.value = ''
  selectedIllustration.value = item.id
  activeSpineSet.value = 'illustration'
  activeCatalogMode.value = 'animations'
  skinMenuOpen.value = false
  loopPlayback.value = true
  playing.value = true
  spineFiles.value = []
  availableAnimations.value = []
  selectedAnimation.value = ''
  availableSkins.value = []
  selectedSkin.value = ''
  availableLayers.value = []
  layerVisibility.value = {}
  importError.value = ''
}
function selectSpineSet(set) {
  skinMenuOpen.value = false
  if (set === 'illustration' || set === 'accessories') {
    filtersOpen.value = false
    if (activeSpineSet.value === set) { activeCatalogMode.value = 'animations'; return }
    activeSpineSet.value = set
    activeCatalogMode.value = 'animations'
    loopPlayback.value = true
    spineFiles.value = []
    availableAnimations.value = []
    selectedAnimation.value = ''
    availableSkins.value = []
    selectedSkin.value = ''
    availableLayers.value = []
    layerVisibility.value = {}
    importError.value = ''
    return
  }
  if (set === 'ultimate' && !selectedCharacterData.value.cutscene) return
  if (set === 'dating' && !selectedCharacterData.value.dating) return
  if (activeSpineSet.value === set) return
  filtersOpen.value = false
  activeSpineSet.value = set
  availableLayers.value = []
  layerVisibility.value = {}
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
  if (activeSpineSet.value === 'illustration') {
    availableAnimations.value = [...new Set((names || []).filter(Boolean))]
    selectedAnimation.value = availableAnimations.value[0] || ''
    return
  }
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
  const supportsSkinSelection = activeSpineSet.value === 'dating' || activeSpineSet.value === 'illustration'
  const selectableSkins = supportsSkinSelection ? [...new Set((names || []).filter(Boolean))] : []
  availableSkins.value = selectableSkins.length > 1 ? selectableSkins : []
  selectedSkin.value = selectableSkins.includes(initialSkin) ? initialSkin : selectableSkins[0] || initialSkin || ''
}
function onLayers(names) {
  availableLayers.value = [...new Set((names || []).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  layerVisibility.value = Object.fromEntries(availableLayers.value.map((name) => [name, true]))
}
function toggleLayer(name) {
  if (!availableLayers.value.includes(name) || !spinePreviewRef.value) return
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
  if (!topbarOverflowRef.value?.contains(event.target)) { topbarMenuOpen.value = false; languageMenuOpen.value = false }
  if (filtersOpen.value && !filtersAreaRef.value?.contains(event.target)) filtersOpen.value = false
  if (!exportMenuRef.value?.contains(event.target)) exportMenuOpen.value = false
  if (!cameraMenuRef.value?.contains(event.target)) cameraMenuOpen.value = false
  if (!audioMenuRef.value?.contains(event.target)) audioMenuOpen.value = false
  if (!languageMenuRef.value?.contains(event.target) && !desktopLanguageMenuRef.value?.contains(event.target)) languageMenuOpen.value = false
}
function cycleSpeed() {
  const speeds = [0.5, 1, 1.5, 2]
  playbackSpeed.value = speeds[(speeds.indexOf(playbackSpeed.value) + 1) % speeds.length]
}
function activateFullscreenFallback() {
  fullscreenFallback.value = true
  isFullscreen.value = true
  document.addEventListener('pointerdown', scheduleFullscreenControlsHide, { passive: true })
  document.addEventListener('pointermove', scheduleFullscreenControlsHide, { passive: true })
  scheduleFullscreenControlsHide()
}
function toggleFullscreen() {
  if (isFullscreen.value) {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else {
      fullscreenFallback.value = false
      isFullscreen.value = false
      fullscreenControlsHidden.value = false
      clearFullscreenHideTimer()
      document.removeEventListener('pointerdown', scheduleFullscreenControlsHide)
      document.removeEventListener('pointermove', scheduleFullscreenControlsHide)
    }
    return
  }
  const element = stageRef.value
  if (!element) return
  if (typeof element.requestFullscreen !== 'function') {
    activateFullscreenFallback()
    return
  }
  try {
    const request = element.requestFullscreen()
    request?.catch?.(activateFullscreenFallback)
  } catch {
    activateFullscreenFallback()
  }
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
  const nativeFullscreen = document.fullscreenElement === stageRef.value
  if (nativeFullscreen) fullscreenFallback.value = false
  else if (fullscreenFallback.value) return
  isFullscreen.value = nativeFullscreen
  fullscreenControlsHidden.value = false
  clearFullscreenHideTimer()
  document.removeEventListener('pointerdown', scheduleFullscreenControlsHide)
  document.removeEventListener('pointermove', scheduleFullscreenControlsHide)
  if (isFullscreen.value) {
    document.addEventListener('pointerdown', scheduleFullscreenControlsHide, { passive: true })
    document.addEventListener('pointermove', scheduleFullscreenControlsHide, { passive: true })
    scheduleFullscreenControlsHide()
  }
}
function handleGlobalKeydown(event) {
  if (event.key === 'Escape' && fullscreenFallback.value) {
    fullscreenFallback.value = false
    isFullscreen.value = false
    fullscreenControlsHidden.value = false
    clearFullscreenHideTimer()
    document.removeEventListener('pointerdown', scheduleFullscreenControlsHide)
    document.removeEventListener('pointermove', scheduleFullscreenControlsHide)
    return
  }
  if (event.key === 'Escape' && languageMenuOpen.value) { languageMenuOpen.value = false; return }
  if (event.key === 'Escape' && languageMenuOpen.value) { languageMenuOpen.value = false; return }
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
  document.documentElement.lang = locale.value
  window.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('pointerdown', handleExportMenuOutside)
  document.addEventListener('fullscreenchange', syncFullscreenState)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  document.removeEventListener('pointerdown', handleExportMenuOutside)
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  document.removeEventListener('pointerdown', scheduleFullscreenControlsHide)
  document.removeEventListener('pointermove', scheduleFullscreenControlsHide)
  clearFullscreenHideTimer()
})
</script>

<template>
  <div class="app-shell">
    <main class="main-content">
      <header class="topbar">
        <button class="topbar-brand" type="button" :aria-label="t('Return to start')" @click="returnToStart"><img class="topbar-brand-avatar" :src="`${assetBaseUrl}justia-logo.webp`" alt="" /><span class="topbar-brand-copy"><span class="topbar-brand-game">BROWN DUST 2</span><span class="topbar-brand-viewer">L2D VIEWER</span></span></button>
        <nav class="top-actions" :aria-label="locale === 'ru' ? 'Сообщество' : 'Community'">
          <a class="topbar-action topbar-action-telegram" href="https://t.me/browndust_2" target="_blank" rel="noopener noreferrer"  :data-tooltip="t('Open Telegram channel')" :aria-label="t('Open Brown Dust 2 Telegram channel')"><img class="topbar-brand-icon topbar-brand-icon-telegram" src="https://telegram.org/img/t_logo.png" alt="" /></a>
          <a class="topbar-action" href="https://github.com/mirasaveher/BrownDust2-L2D-Viewer" target="_blank" rel="noopener noreferrer"  :data-tooltip="t('Open GitHub repository')" :aria-label="t('Open GitHub repository')"><img class="topbar-brand-icon topbar-brand-icon-github" src="https://cdn.simpleicons.org/github/FFFFFF" alt="" /></a>
          <div class="desktop-topbar-tools"><div ref="desktopLanguageMenuRef" class="language-menu-wrap" :class="{ open: languageMenuOpen }"><button type="button" class="topbar-action language-trigger" :data-tooltip="t('Change language')" :aria-label="t('Choose interface language')" :aria-expanded="languageMenuOpen" aria-haspopup="true" @click="languageMenuOpen = !languageMenuOpen"><Languages :size="18" :stroke-width="2" /></button><div v-if="languageMenuOpen" class="player-menu-popover language-popover" role="menu" :aria-label="t('Interface language')"><button type="button" class="language-option" :class="{ selected: locale === 'en' }" role="menuitemradio" :aria-checked="locale === 'en'" @click="setLocale('en')">English<span v-if="locale === 'en'">✓</span></button><button type="button" class="language-option" :class="{ selected: locale === 'ru' }" role="menuitemradio" :aria-checked="locale === 'ru'" @click="setLocale('ru')">Русский<span v-if="locale === 'ru'">✓</span></button></div></div><button type="button" class="topbar-action coupon-center-action" :data-tooltip="t('Coupon codes')" :aria-label="t('Open coupon center')" :aria-expanded="couponModalOpen" @click="couponModalOpen = true"><TicketPercent :size="18" :stroke-width="2" color="#ffffff" /></button><button type="button" class="topbar-action topbar-changelog-action" :data-tooltip="t('Changelog')" :aria-label="t('Open changelog')" :aria-expanded="changelogOpen" @click="changelogOpen = true"><FileText :size="20" :stroke-width="2.2" /></button></div><div class="mobile-topbar-tools"><button type="button" class="topbar-action mobile-language-toggle" :aria-label="t('Change language')" @click="setLocale(locale === 'en' ? 'ru' : 'en')"><span>{{ locale === 'en' ? 'EN' : 'RU' }}</span></button><button type="button" class="topbar-action coupon-center-action" :aria-label="t('Open coupon center')" @click="couponModalOpen = true"><TicketPercent :size="18" /></button><button type="button" class="topbar-action topbar-changelog-action" :aria-label="t('Open changelog')" @click="changelogOpen = true"><FileText :size="19" /></button></div>
        </nav>
      </header>

      <section v-if="activeTab === 'viewer'" class="page viewer-page">
        <div class="viewer-heading">
          <div><div class="eyebrow">BROWN DUST II · {{ activeSpineSet === 'illustration' ? t('ILLUSTRATION LAB') : activeSpineSet === 'accessories' ? t('ACCESSORY LAB') : t('CHARACTER LAB') }}</div><h1>{{ selectedCharacterName }}<span class="heading-period">.</span></h1><p>{{ activeSpineSet === 'illustration' ? t('Special illustrations · Spine animation') : activeSpineSet === 'accessories' ? t('Accessories · Spine animation') : (selectedCharacterData.costumeName ? selectedCharacterData.costumeName + ' · ' : '') + (/^\d+$/.test(selectedCharacter) ? selectedCharacter + ' · ' : '') + (activeSpineSet === 'character' ? t('Standard animations') : activeSpineSet === 'ultimate' ? t('Ultimate animation') : t('Fated Guest')) }}</p></div>
          <div class="viewer-heading-actions"><span class="gallery-count">{{ activeSpineSet === 'illustration' ? countLabel(illustSpecialRegistry.length, 'ILLUSTRATIONS') : activeSpineSet === 'accessories' ? countLabel(accessoryRegistry.length, 'ITEMS') : countLabel(characters.length, 'CHARACTERS') }}</span><button class="button-secondary" @click="showImport = true"><Plus :size="15" /> {{ t('Import assets') }}</button></div>
        </div>
        <div class="studio-layout">
          <button v-if="mobilePanel" type="button" class="mobile-panel-backdrop" aria-label="Close panel" @click="mobilePanel = false"></button>
          <aside class="catalog-panel" :class="{ 'mobile-panel-open': mobilePanel, 'mobile-show-characters': mobilePanel === 'characters', 'mobile-show-animations': mobilePanel === 'animations', 'mobile-show-layers': mobilePanel === 'layers' }">
            <div class="mobile-catalog-header"><strong>{{ mobilePanel === 'characters' ? t('CHARACTER LIST') : mobilePanel === 'layers' ? t('LAYERS') : t('ANIMATION SET') }}</strong><button type="button" class="mobile-catalog-close" aria-label="Close" @click="mobilePanel = ''"><X :size="18" /></button></div>
            <div ref="filtersAreaRef" class="catalog-search-row"><div class="catalog-search catalog-search-compact"><Search :size="16" /><input v-model="search" :placeholder="t(activeSpineSet === 'illustration' ? 'Search illustrations...' : 'Search...')" :aria-label="t(activeSpineSet === 'illustration' ? 'Search illustrations' : 'Search characters')" /><button v-if="search" class="clear-search" :data-tooltip="t('Clear search')" @click="search = ''"><X :size="14" /></button></div>
            <button class="catalog-filter-trigger" :class="{ active: filtersOpen || activeFilters.length }"  :aria-label="t('Open filters')" :aria-expanded="filtersOpen" @click="openFilters"><SlidersHorizontal :size="15" /><span>{{ t('Filters') }}</span><i v-if="activeFilters.length">{{ activeFilters.length }}</i></button>
            
            <div v-if="filtersOpen" class="catalog-filter-popover">
              <div class="catalog-filter-popover-head"><strong>{{ t('Filters & sorting') }}</strong></div>
              <div class="filter-chips filter-chips-vertical">
                <button v-for="filter in [{ id: 'FG', label: t('Fated Guest') }, { id: 'U', label: t('Ultimate') }, { id: 'PC', label: t('Playable Characters') }, { id: 'NPC', label: t('NPCs') }]" :key="filter.id" class="filter-chip" :class="{ active: pendingFilters.includes(filter.id), ['filter-' + filter.id.toLowerCase()]: true }" :aria-pressed="pendingFilters.includes(filter.id)" @click="toggleCatalogFilter(filter.id)"><span>{{ filter.id }}</span>{{ filter.label }}</button>
                <button type="button" class="filter-chip special-illustration-filter" :class="{ active: pendingFilters.includes('SI') }" :aria-pressed="pendingFilters.includes('SI')" @click="toggleCatalogFilter('SI')"><span class="special-illustration-icon" aria-hidden="true">SI</span>{{ t('Special Illustrations') }}</button>
                <button type="button" class="filter-chip accessories-filter" :class="{ active: pendingFilters.includes('AC') }" :aria-pressed="pendingFilters.includes('AC')" @click="toggleCatalogFilter('AC')"><span class="accessories-filter-icon" aria-hidden="true">AC</span>{{ t('Accessories') }}</button>
              </div>
              <div class="filter-popover-footer"><button type="button" class="filter-reset-button" :disabled="!activeFilters.length && !pendingFilters.length && !search && !caseSensitive && sortBy === 'name-asc'" @pointerdown.stop @click.stop.prevent="resetFilters"><RotateCcw :size="14" /><span>{{ t('Reset') }}</span></button><button class="filter-apply-button" @click="applyFilters">{{ t('Apply filters') }}</button></div>
            </div></div>
             <div class="catalog-list-heading"><span>{{ catalogHeading }}</span><span>{{ countLabel(filteredCatalogItems.length, 'ITEMS') }}</span></div>
             <div class="catalog-character-list">
               <template v-for="entry in filteredCatalogItems" :key="`${entry.type}-${entry.item.id}`">
                 <button v-if="entry.type === 'character'" class="catalog-character" :class="{ selected: selectedCharacter === entry.item.id }" @click="chooseCharacter(entry.item)">
                   <span class="catalog-avatar"><img :src="entry.item.icon" :alt="`${entry.item.displayName} icon`" loading="lazy" /></span><span class="catalog-character-info"><strong>{{ entry.item.displayName }}</strong><small>{{ entry.item.costumeName ? entry.item.costumeName + (/^\d+$/.test(entry.item.id) ? " · " : "") : "" }}{{ /^\d+$/.test(entry.item.id) ? entry.item.id : "" }}</small><span class="catalog-tags"><i v-if="entry.item.hasDating" class="tag-fg">FG</i><i v-if="entry.item.hasUltimate" class="tag-ultimate">U</i><i v-if="entry.item.isNpc" class="tag-npc">NPC</i></span></span><span class="catalog-character-end"><span v-if="selectedCharacter === entry.item.id" class="selected-dot"></span><span v-if="['068001', '001297'].includes(entry.item.id)" class="catalog-new-badge">{{ t('NEW') }}</span></span>
                 </button>
                 <button v-else-if="entry.type === 'accessory'" class="catalog-character" :class="{ selected: selectedAccessory === entry.item.id }" @click="selectAccessory(entry.item)">
                   <span class="catalog-avatar accessory-avatar"><Gem :size="18" /></span><span class="catalog-character-info"><strong>{{ t('Accessory') }} {{ entry.item.id }}</strong></span><span v-if="selectedAccessory === entry.item.id" class="selected-dot"></span>
                 </button>
                 <button v-else class="catalog-character" :class="{ selected: selectedIllustration === entry.item.id }" @click="selectIllustration(entry.item)">
                   <span class="catalog-avatar special-illustration-avatar"><Image :size="18" /></span><span class="catalog-character-info"><strong>{{ entry.item.label }}</strong></span><span v-if="selectedIllustration === entry.item.id" class="selected-dot"></span>
                 </button>
               </template>
               <div v-if="!filteredCatalogItems.length" class="gallery-empty">{{ t('No matching items.') }}</div>
             </div>
            <div class="catalog-animation-section">
              <div class="catalog-list-heading"><span>{{ activeCatalogMode === 'animations' ? t('ANIMATION SET') : t('LAYERS') }}</span><span>{{ activeCatalogMode === 'animations' ? countLabel(availableAnimations.length, 'ANIMATIONS') : countLabel(availableLayers.length, 'LAYERS') }}</span></div>
              <div class="catalog-category-row">
                <div class="catalog-category-list">
                  <button class="category-option set-standard" :class="{ selected: activeSpineSet === 'character' }" @click="activeCatalogMode = 'animations'; selectSpineSet('character')"><Activity :size="15" /><span>{{ t('Standard') }}</span><i v-if="activeSpineSet === 'character'"></i></button>
                  <button v-if="selectedCharacterData.cutscene && activeSpineSet !== 'illustration' && activeSpineSet !== 'accessories'" class="category-option set-ultimate" :class="{ selected: activeSpineSet === 'ultimate' }" @click="activeCatalogMode = 'animations'; selectSpineSet('ultimate')"><Film :size="15" /><span>{{ t('Ultimate') }}</span><i v-if="activeSpineSet === 'ultimate'"></i></button>
                  <button v-if="selectedCharacterData.dating && activeSpineSet !== 'illustration' && activeSpineSet !== 'accessories'" class="category-option set-fg" :class="{ selected: activeSpineSet === 'dating' }" @click="activeCatalogMode = 'animations'; selectSpineSet('dating')"><BookOpen :size="15" /><span>{{ t('Fated Guest') }}</span><i v-if="activeSpineSet === 'dating'"></i></button>
                </div>
                <button class="category-option layers-tab set-layers" :class="{ selected: activeCatalogMode === 'layers' }" :aria-pressed="activeCatalogMode === 'layers'" @click="activeCatalogMode = activeCatalogMode === 'layers' ? 'animations' : 'layers'"><Layers3 :size="16" /><span>{{ t('Layers') }}</span><i v-if="activeCatalogMode === 'layers'"></i></button>
              </div>
              <div v-if="activeCatalogMode === 'animations' && (activeSpineSet === 'dating' || activeSpineSet === 'illustration') && availableSkins.length > 1" class="skins-control">
                <div class="skins-control-heading"><span>{{ t('SKINS') }}</span></div>
                <div class="skins-select-wrap">
                  <button class="skins-select" type="button" :aria-label="t('Choose model skin')" :aria-expanded="skinMenuOpen" @click="skinMenuOpen = !skinMenuOpen">
                    <span>{{ selectedSkin || t('Select skin') }}</span><ChevronDown :size="15" class="skins-select-chevron" />
                  </button>
                  <div v-if="skinMenuOpen" class="skins-options" role="listbox" :aria-label="t('Available skins')">
                    <button v-for="skin in availableSkins" :key="skin" type="button" role="option" :aria-selected="selectedSkin === skin" :class="{ selected: selectedSkin === skin }" @click="selectedSkin = skin; skinMenuOpen = false">{{ skin }}</button>
                  </div>
                </div>
                
              </div>
              <div v-if="activeCatalogMode === 'animations'" class="catalog-animation-list">
                <button v-for="name in availableAnimations" :key="name" class="catalog-animation" :class="{ selected: selectedAnimation === name }" @click="selectedAnimation = name"><span>{{ datingAnimationCatalog.find(item => item.key === name)?.label || name }}</span><i v-if="selectedAnimation === name"></i></button>
                <div v-if="!availableAnimations.length" class="animation-empty">{{ t('Loading animations…') }}</div>
              </div>
              <div v-else class="catalog-layers-view">
                <div class="layers-search">
                  <Search :size="15" />
                  <input v-model="layerSearch" type="search" :placeholder="t('Search layers...')" :aria-label="t('Search layers')" />
                  <button v-if="layerSearch" type="button" class="layers-search-clear" :aria-label="t('Clear layer search')" @click="layerSearch = ''"><X :size="13" /></button>
                </div>
                <div class="layers-actions"><button @click="setAllLayers(true)">{{ t('Show all') }}</button><button @click="setAllLayers(false)">{{ t('Hide all') }}</button></div>
                <div v-if="availableLayers.length" class="layers-list">
                  <label v-for="name in filteredLayers" :key="name" class="layer-item">
                    <span class="layer-name">{{ name }}</span>
                    <input class="layer-checkbox" type="checkbox" :checked="layerVisibility[name] !== false" :aria-label="`${layerVisibility[name] === false ? t('Show') : t('Hide')} ${name}`" @change="toggleLayer(name)" />
                    <span class="layer-visibility-indicator" :class="{ hidden: layerVisibility[name] === false }" aria-hidden="true">
                      <Eye v-if="layerVisibility[name] !== false" :size="15" />
                      <EyeOff v-else :size="15" />
                    </span>
                  </label>
                  <div v-if="!filteredLayers.length" class="animation-empty">{{ t('No matching layers.') }}</div>
                </div>
                <div v-else class="animation-empty">{{ t('Layers appear after the Spine model loads.') }}</div>
              </div>
            </div>
          </aside>
          <section ref="stageRef" class="stage-panel" :class="{ 'controls-hidden': isFullscreen && fullscreenControlsHidden, 'mobile-fullscreen': fullscreenFallback }">
            <div class="panel-topline"><div class="panel-label"><span class="live-indicator"></span><span class="panel-costume-title">{{ activeCostumeTitle }}</span><span class="muted-tag" :class="activeSpineSet === 'character' ? 'tag-standard' : activeSpineSet === 'ultimate' ? 'tag-ultimate' : activeSpineSet === 'dating' ? 'tag-fg' : activeSpineSet === 'accessories' ? 'tag-accessory' : 'tag-standard'" :style="activeSpineSet === 'illustration' ? { color: '#f3d18a', borderColor: '#9d7b3f', background: '#3a2e19' } : null">{{ activeSpineSet === 'character' ? t('Standard').toUpperCase() : activeSpineSet === 'ultimate' ? t('Ultimate').toUpperCase() : activeSpineSet === 'dating' ? t('Fated Guest').toUpperCase() : activeSpineSet === 'accessories' ? t('Accessories').toUpperCase() : t('Special Illustrations').toUpperCase() }}</span></div><div class="stage-actions"><span class="zoom-readout desktop-zoom-readout">{{ previewScale }}%</span><button class="icon-button desktop-zoom-button" :data-tooltip="t('Reset position and zoom')" :aria-label="t('Reset position and zoom')" @click="spinePreviewRef?.resetView?.()"><RotateCcw :size="15" /></button><button class="icon-button desktop-zoom-button" :aria-label="t('Zoom out')" @click="spinePreviewRef?.zoomOut?.()"><Minus :size="15" /></button><button class="icon-button desktop-zoom-button" :aria-label="t('Zoom in')" @click="spinePreviewRef?.zoomIn?.()"><Plus :size="15" /></button><button class="icon-button mobile-camera-reset" :aria-label="t('Reset position and zoom')" @click="spinePreviewRef?.resetView?.()"><RotateCcw :size="15" /></button></div></div>
            <div class="stage stage-large" :class="selectedCharacterName.toLowerCase()" >
              <div class="stage-grid"></div><div class="orb orb-one"></div><div class="orb orb-two"></div>
              <div class="stage-watermark"><Sparkles :size="15" /> BROWNDUST2 L2D VIEWER</div>
              <SpinePreview ref="spinePreviewRef" :files="spineFiles" :asset-base="activeAssetBase" :first-animation="activeSpineSet === 'illustration'" :animation="previewAnimation" :skin="selectedSkin" :composites="activeComposites" :dating-tracks="activeSpineSet === 'dating' && selectedCharacterData.datingUsesTracks" :playing="playing" :loop="loopPlayback" :scale="previewScale" :speed="playbackSpeed" :use-current-camera="useCurrentCameraForExport" :audio-base="activeSpineSet === 'character' ? selectedAudioBase : ''" @animations="onAnimations" @skins="onSkins" @layers="onLayers" @error="onSpineError" @progress="playbackProgress = $event" @duration="animationDuration = $event" @zoom="previewScale = $event" />
              <div v-if="activeSpineSet === 'dating' && datingPreloadAssetBase" style="position:fixed;left:-10000px;top:0;width:640px;height:480px;opacity:0;pointer-events:none;z-index:-1" aria-hidden="true">
                <SpinePreview :asset-base="datingPreloadAssetBase" animation="" :dating-tracks="true" :playing="false" :loop="true" :scale="100" :speed="1" @animations="onDatingPreloadAnimations" />
              </div>
              <div v-if="importError" class="spine-error">{{ importError }}</div>
              <div v-if="!activeAssetBase && !spineFiles.length" class="stage-placeholder"><div class="placeholder-emblem"><Image :size="31" /></div><div class="placeholder-title">{{ selectedCharacterName }}</div><div class="placeholder-subtitle">{{ t('CHARACTER PREVIEW') }}</div><div class="placeholder-rule"></div><p>{{ t('Animation preview will appear here') }}<br />{{ t('when a compatible asset is loaded.') }}</p><button class="button-primary small" @click="showImport = true"><Plus :size="15" /> {{ t('Add character files') }}</button></div>
              
            </div>
            <div class="player-bar">
              <div class="player-controls"><button class="icon-button" :aria-label="t('Previous animation')" @click="selectRelativeAnimation(-1)" :disabled="!availableAnimations.length"><ChevronLeft :size="17" /></button><button class="play-button" :aria-label="t('Play or pause')" @click="playing = !playing"><Pause v-if="playing" :size="17" /><Play v-else :size="17" /></button><button class="icon-button" :aria-label="t('Next animation')" @click="selectRelativeAnimation(1)" :disabled="!availableAnimations.length"><ChevronRight :size="17" /></button><span class="timecode">{{ previewAnimation || t('No animation selected') }}</span></div>
              <div class="timeline-group"><div class="timeline timeline-seek" :style="{ '--timeline-hover-x': (timelineHoverProgress * 100) + '%' }" role="slider" :aria-label="t('Seek animation')" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(playbackProgress * 100)" @pointerdown="seekTimeline" @pointermove="seekTimeline" @pointerup="endTimelineSeek" @pointercancel="endTimelineSeek" @lostpointercapture="endTimelineSeek" @mousemove="updateTimelineHover" @mouseleave="timelineHoverProgress = 0"><span class="timeline-played" :style="{ width: (playbackProgress * 100) + '%' }"></span><span class="timeline-hover" :style="{ width: (timelineHoverProgress * 100) + '%' }"></span></div><span class="timeline-time">{{ formatTime(playbackProgress * animationDuration) }} / {{ formatTime(animationDuration) }}</span></div>
              <div class="player-options"><div ref="audioMenuRef" class="player-menu-wrap audio-menu-wrap"><button type="button" class="icon-button export-icon-button player-menu-trigger" :class="{ active: audioMenuOpen }" :data-tooltip="t('Voice language')" :aria-label="t('Voice language')" :aria-expanded="audioMenuOpen" @click="audioMenuOpen = !audioMenuOpen"><Volume2 :size="17" /></button><div v-if="audioMenuOpen" class="player-menu-popover audio-menu-popover"><button type="button" :class="{ selected: audioLanguage === 'JP' }" :aria-pressed="audioLanguage === 'JP'" @click="setAudioLanguage('JP'); audioMenuOpen = false">JP <span>{{ audioLanguage === 'JP' ? t('Selected') : '' }}</span></button><button type="button" :class="{ selected: audioLanguage === 'KR' }" :aria-pressed="audioLanguage === 'KR'" @click="setAudioLanguage('KR'); audioMenuOpen = false">KR <span>{{ audioLanguage === 'KR' ? t('Selected') : '' }}</span></button></div></div><button v-if="isFullscreen" class="icon-button fullscreen-reset-button" :data-tooltip="t('Reset position and zoom')" :aria-label="t('Reset position and zoom')" @click="spinePreviewRef?.resetView?.()"><RotateCcw :size="15" /></button><button class="speed-button" :data-tooltip="t('Playback speed')" :aria-label="t('Playback speed')" @click="cycleSpeed">{{ playbackSpeed }}×</button><button class="icon-button export-icon-button screenshot-button" :data-tooltip="t('Save screenshot')" :aria-label="t('Save screenshot')" :disabled="isScreenshotting" @click="takeScreenshot"><Camera :size="17" /></button><div ref="cameraMenuRef" class="player-menu-wrap settings-menu-wrap"><button type="button" class="icon-button export-icon-button player-menu-trigger" :class="{ active: cameraMenuOpen }" :data-tooltip="t('Screenshot settings')" :aria-label="t('Screenshot settings')" :aria-expanded="cameraMenuOpen" @click="cameraMenuOpen = !cameraMenuOpen"><Settings2 :size="17" /></button><div v-if="cameraMenuOpen" class="player-menu-popover settings-menu-popover"><button type="button" :class="{ selected: transparentScreenshot }" :aria-pressed="transparentScreenshot" @click="transparentScreenshot = !transparentScreenshot">{{ t('Transparent background') }} <span>{{ transparentScreenshot ? t('On') : t('Off') }}</span></button><button type="button" :class="{ selected: useCurrentCameraForExport }" :aria-pressed="useCurrentCameraForExport" @click="useCurrentCameraForExport = !useCurrentCameraForExport">{{ t('Use current camera') }} <span>{{ useCurrentCameraForExport ? t('On') : t('Off') }}</span></button></div></div><div ref="exportMenuRef" class="export-menu-wrap"><button class="icon-button export-icon-button animation-export-button" :class="{ active: exportMenuOpen }" :data-tooltip="isExportingAnimation ? t('Exporting animation') : t('Export animation')" :aria-label="t('Export animation')" :aria-expanded="exportMenuOpen" :disabled="isExportingAnimation || !selectedAnimation" @click="exportMenuOpen = !exportMenuOpen"><Download :size="16" /></button><div v-if="exportMenuOpen" class="export-menu-popover"><button type="button" @click="exportAnimation('frames')">{{ t('Export frames (ZIP)') }}</button><button type="button" @click="exportAnimation('webm')">{{ t('Export WebM') }}</button><button type="button" @click="exportAnimation('gif')">{{ t('Export GIF') }}</button></div></div><button class="icon-button fullscreen-toggle-button" :data-tooltip="isFullscreen ? t('Exit Full Screen') : t('Full Screen')" :aria-label="isFullscreen ? t('Exit Full Screen') : t('Full Screen')" @click="toggleFullscreen"><Minimize2 v-if="isFullscreen" :size="16" /><Expand v-else :size="16" /></button></div>
            </div>
            <nav class="mobile-workspace-nav" aria-label="Viewer controls">
              <button type="button" :class="{ active: mobilePanel === 'characters' }" @click="mobilePanel = mobilePanel === 'characters' ? '' : 'characters'"><Search :size="17" /><span>{{ t('Characters') }}</span></button>
              <button type="button" :class="{ active: mobilePanel === 'animations' }" @click="mobilePanel = mobilePanel === 'animations' ? '' : 'animations'; activeCatalogMode = 'animations'"><Film :size="17" /><span>{{ t('Animations') }}</span></button>
              <button type="button" :class="{ active: mobilePanel === 'layers' }" @click="mobilePanel = mobilePanel === 'layers' ? '' : 'layers'; activeCatalogMode = 'layers'"><Layers3 :size="17" /><span>{{ t('Layers') }}</span></button>
            </nav>
          </section>
        </div>
      </section>

      <section v-else class="page simple-page">
        <div class="page-heading"><div><div class="eyebrow">BROWNDUST2 L2D VIEWER</div><h1>{{ activeTab === 'library' ? t('Asset library') : t('Collections') }}<span class="heading-period">.</span></h1><p>{{ t('This workspace is ready for your character and animation assets.') }}</p></div><button class="button-secondary" @click="showImport = true"><CloudUpload :size="16" /> {{ t('Import assets') }}</button></div>
        <div class="empty-state-large"><div class="empty-icon"><BookOpen :size="23" /></div><h2>{{ activeTab === 'library' ? t('Your library starts here') : t('Your collections starts here') }}</h2><p>{{ t('Import compatible files and they will appear in this workspace.') }}</p><button class="button-primary" @click="showImport = true"><Plus :size="16" /> {{ t('Import assets') }}</button></div>
      </section>
    </main>

    <div v-if="couponModalOpen" class="modal-backdrop coupon-backdrop" @click.self="couponModalOpen = false">
      <section class="coupon-modal" role="dialog" aria-modal="true" aria-labelledby="coupon-title">
        <div class="modal-heading">
          <div><div class="eyebrow">BROWN DUST 2</div><h2 id="coupon-title">{{ t('COUPON CENTER') }}</h2></div>
          <button type="button" class="icon-button" :aria-label="t('Close changelog')" @click="couponModalOpen = false"><X :size="18" /></button>
        </div>
        <label class="coupon-nickname-label" for="coupon-nickname">{{ t('Enter your in-game nickname') }}</label>
        <input id="coupon-nickname" v-model="couponNickname" class="coupon-nickname-input" type="text" autocomplete="nickname" maxlength="40" :placeholder="t('Enter your in-game nickname')" @input="saveCouponNickname" />
        <div class="coupon-list">
          <article v-for="coupon in couponList" :key="coupon.code" class="coupon-card">
            <div class="coupon-card-main">
              <div class="coupon-card-code">{{ coupon.code }}</div>
              <div class="coupon-card-reward">{{ locale === 'ru' ? coupon.rewardRu : coupon.reward }}</div>
              <div class="coupon-card-expiry">{{ t('Expires') }}: {{ locale === 'ru' ? (coupon.expiresRu || coupon.expires) : coupon.expires }}</div>
            </div>
            <span class="coupon-status" :class="'status-' + (couponStatus(coupon.code) || 'idle')">{{ couponStatusLabel(coupon.code) }}</span>
          </article>
        </div>
        <button type="button" class="button-primary coupon-claim-button" :disabled="!couponNickname.trim() || couponClaiming" @click="claimAllCoupons">
          <TicketPercent v-if="!couponClaiming" :size="16" /><span>{{ couponClaiming ? t('Claiming...') : t('CLAIM ALL') }}</span>
        </button>
        <p v-if="!couponNickname.trim()" class="coupon-helper">{{ t('Enter your nickname to continue') }}</p>
        <p class="coupon-footnote">{{ t('Rewards are sent to your in-game mailbox.') }}</p>
      </section>
    </div>
    <div v-if="changelogOpen" class="modal-backdrop changelog-backdrop" @click.self="changelogOpen = false">
      <section class="changelog-modal" role="dialog" aria-modal="true" aria-labelledby="changelog-title">
        <div class="modal-heading">
          <div><div class="eyebrow">BROWN DUST 2 · L2D VIEWER</div><h2 id="changelog-title">{{ t('Changelog') }}</h2></div>
          <button type="button" class="icon-button" :aria-label="t('Close changelog')" @click="changelogOpen = false"><X :size="18" /></button>
        </div>
        <div class="changelog-content">
          <div class="changelog-scroll-area">
            <article class="changelog-entry">
              <div class="changelog-entry-meta"><time datetime="2026-11-18">18/11/2026</time><span class="changelog-tag tag-new">{{ t('NEW') }}</span></div>
              <div class="changelog-entry-copy">
                <p>{{ t('Added support for accessory animations and a dedicated Accessories category.') }}</p>
                <p>{{ t('Completely redesigned layer display and visibility controls.') }}</p>
                <p>{{ t('Introduced a fully responsive mobile version with touch gestures, streamlined navigation, and a dedicated fullscreen mode.') }}</p>
                <p>{{ t('Added a coupon center for redeeming available codes, including one-click activation of all listed coupons.') }}</p>
                <p>{{ t('Added Russian interface localization.') }}</p>
                <p>{{ t('Improved the interface, filters, navigation, and animation browsing experience.') }}</p>
              </div>
            </article>
            <article class="changelog-entry">
              <div class="changelog-entry-meta"><time datetime="2026-11-05">05/11/2026</time></div>
              <div class="changelog-entry-copy">
                <p>{{ t('All special illustrations have been added and are now available under the Filters section.') }}</p>
                <p>{{ t('Added animations and cutscenes for Night of Betrayal Valze.') }}</p>
                <p>{{ t('Added animations and cutscenes for Liatris Sweet Temptation special skin.') }}</p>
                <p>{{ t('Various UI improvements and minor bug fixes.') }}</p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
    <div v-if="showImport" class="modal-backdrop" @click.self="showImport = false">
      <div class="import-modal"><div class="modal-heading"><div><div class="eyebrow">{{ t('ASSET MANAGER') }}</div><h2>{{ t('Import character files') }}</h2></div><button class="icon-button" @click="showImport = false"><X :size="18" /></button></div>
        <label class="drop-zone"><input type="file" multiple accept=".skel,.json,.atlas,.png,.webp" @change="onFiles" /><span class="upload-icon"><CloudUpload :size="23" /></span><strong>{{ t('Choose files to import') }}</strong><small>{{ t('Drop files here or browse your device') }}</small><em>{{ t('Select the .atlas, .skel/.json file and all associated .png/.webp textures.') }}</em></label>
        <p v-if="importError" class="import-error">{{ importError }}</p>
        <div class="modal-footer"><span>{{ spineFiles.length ? t('Files are ready to preview') : t('Select a complete set of Spine files') }}</span><button class="button-primary" @click="showImport = false">{{ t('Done') }} <ChevronRight :size="15" /></button></div>
      </div>
    </div>
  </div>
</template>
<style>.language-trigger{ color:#fff !important; }.language-trigger svg{ color:#fff !important; stroke:#fff !important; }.language-trigger:hover{ color:#fff !important; }

.language-menu-wrap { position:relative; display:inline-flex; flex:0 0 34px; width:34px; height:34px; }
.language-menu-wrap.open { z-index:500; }
.language-trigger[aria-expanded='true'] { color:#fff !important; }
.language-menu-wrap .language-popover { top:calc(100% + 8px); right:0; bottom:auto; z-index:500; width:150px; min-width:150px; }
.language-popover .language-option { min-height:32px; padding:8px 10px; border:0; border-radius:5px; background:transparent; color:#d8d4e0; font:inherit; font-size:10px; text-align:left; }
.language-popover .language-option:hover,
.language-popover .language-option.selected { background:#302b3d; color:#fff; }
.language-popover .language-option span { color:#c9b2ed; font-size:9px; }
.language-popover .language-option:focus-visible { outline:none; }
@media(max-width:600px) { .language-menu-wrap .language-popover { position:absolute; top:calc(100% + 8px); right:0; width:150px; max-width:calc(100vw - 16px); } }

.accessories-filter .accessories-filter-icon {
  box-sizing: border-box; display: grid; place-items: center;
  width: 23px; min-width: 23px; height: 19px; padding: 0;
  border: 1px solid #a94463; border-radius: 4px;
  background: #5b2036; color: #ff8ba8;
  font: 700 9px 'IBM Plex Mono', monospace; letter-spacing: -.4px; line-height: 1;
}
.accessories-filter:hover .accessories-filter-icon { border-color:#ef7998; background:#713047; color:#ffd0dc; }
.accessories-filter.active { border-color:#a94463; background:#3b1d2a; color:#ffd0dc; }
.accessories-filter.active .accessories-filter-icon { border-color:#ef7998; background:#713047; color:#fff0f4; }
.catalog-avatar.accessory-avatar { display:flex; align-items:center; justify-content:center; border-color:transparent; background:linear-gradient(145deg,#5b2036,#2d1721); color:#ff8ba8; box-shadow:none; }
.catalog-character.selected .catalog-avatar.accessory-avatar { border-color:#ef7998; box-shadow:0 0 0 2px #ef79982b,0 4px 14px #09070f88; }
.tag-accessory { color:#ff8ba8; border-color:#a94463; background:#5b2036; }
.panel-label .muted-tag.tag-accessory { color:#ff8ba8; border-color:#a94463; background:#5b2036; }
.panel-label .muted-tag.tag-accessory::before { background:#ff8ba8; box-shadow:0 0 5px #ff8ba866; }
</style>
