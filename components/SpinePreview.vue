<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { SpinePlayer, Vector2, OrthoCamera } from '@esotericsoftware/spine-player'
import '@esotericsoftware/spine-player/dist/spine-player.css'
import { Output, WebMOutputFormat, BufferTarget, CanvasSource, Quality, canEncodeVideo } from 'mediabunny'
import JSZip from 'jszip'
import { GIFEncoder, quantize } from 'gifenc'


function createGifPalette(sampleFrames, transparent) {
  const size=sampleFrames.reduce((sum,frame)=>sum+frame.length,0),samples=new Uint8Array(size)
  let offset=0;sampleFrames.forEach(frame=>{samples.set(frame,offset);offset+=frame.length})
  if(!samples.length)throw new Error('GIF palette sampling produced no visible pixels.')
  const colors=quantize(samples,transparent?255:256)
  return transparent?[[0,0,0],...colors]:colors
}
function createPaletteLookup(palette) {
  const lookup=new Uint8Array(32768)
  for(let r=0;r<32;r++)for(let g=0;g<32;g++)for(let b=0;b<32;b++){
    const red=r*8+4,green=g*8+4,blue=b*8+4;let best=0,distance=Infinity
    for(let i=0;i<palette.length;i++){const c=palette[i],dr=red-c[0],dg=green-c[1],db=blue-c[2],d=dr*dr+dg*dg+db*db;if(d<distance){distance=d;best=i}}
    lookup[(r<<10)|(g<<5)|b]=best
  }
  return lookup
}
function ditherGifFrame(imageData,palette,lookup,transparent) {
  const {data,width,height}=imageData,count=width*height,indices=new Uint8Array(count),work=new Float32Array(count*3)
  for(let p=0;p<count;p++){const s=p*4,d=p*3;work[d]=data[s];work[d+1]=data[s+1];work[d+2]=data[s+2]}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=y*width+x,s=p*4;if(transparent&&data[s+3]<128){indices[p]=0;continue}
    const d=p*3,r=Math.max(0,Math.min(255,work[d])),g=Math.max(0,Math.min(255,work[d+1])),blue=Math.max(0,Math.min(255,work[d+2]))
    const ci=lookup[((r>>3)<<10)|((g>>3)<<5)|(blue>>3)];indices[p]=transparent?ci+1:ci
    const color=palette[ci],er=r-color[0],eg=g-color[1],eb=blue-color[2]
    const spread=(dx,dy,w)=>{const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny>=height)return;const n=(ny*width+nx)*3;work[n]+=er*w;work[n+1]+=eg*w;work[n+2]+=eb*w}
    spread(1,0,7/16);spread(-1,1,3/16);spread(0,1,5/16);spread(1,1,1/16)
  }
  return indices
}
function createGifSample(source,sampleCanvas,sampleContext) {
  const width=Math.max(1,Math.min(240,Math.round(source.width/6))),height=Math.max(1,Math.round(source.height*width/source.width))
  sampleCanvas.width=width;sampleCanvas.height=height;sampleContext.clearRect(0,0,width,height);sampleContext.drawImage(source,0,0,width,height)
  const pixels=sampleContext.getImageData(0,0,width,height).data;let visible=0
  for(let i=3;i<pixels.length;i+=4)if(pixels[i]>=128)visible++
  const result=new Uint8Array(visible*4);let target=0
  for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>=128){result[target++]=pixels[i];result[target++]=pixels[i+1];result[target++]=pixels[i+2];result[target++]=255}
  return result
}

const props = defineProps({
  files: { type: Array, default: () => [] },
  assetBase: { type: String, default: '' },
  firstAnimation: { type: Boolean, default: false },
  animation: { type: String, default: '' },
  skin: { type: String, default: '' },
  composites: { type: Array, default: () => [] },
  datingTracks: { type: Boolean, default: false },
  playing: { type: Boolean, default: true },
  loop: { type: Boolean, default: true },
  scale: { type: Number, default: 100 },
  speed: { type: Number, default: 1 },
  useCurrentCamera: { type: Boolean, default: false },
  audioBase: { type: String, default: '' },
})
const emit = defineEmits(['animations', 'skins', 'layers', 'error', 'ready', 'progress', 'zoom'])

let player = null
let objectUrls = []
const hostEl = ref(null)
let host = null
let loaded = false
let exportingAnimation = false
let loadToken = 0
let progressFrame = 0
let camera = null
let defaultCameraPosition = null
let defaultCameraZoom = 1
let cameraViewReady = false
let cameraZoomValue = 1
let cameraXValue = 0
let cameraYValue = 0
let originalCameraUpdate = null
let activeSkinName = ''
let wheelCanvas = null
let wheelHandler = null
let wheelAnimationFrame = 0
let wheelTargetZoom = 1
let wheelAnchor = null
let wheelLastFrameTime = 0
let panHandlers = null
let activePointerId = null
let lastPointer = null
const hiddenLayers = new Set()
const hiddenSlotAttachments = new Map()
// Voice line rotation + click-to-play motion
let voiceBank = null
let currentVoice = null
let clickTracker = null
const CLICK_MOVE_LIMIT = 8

function haltVoice() {
  if (!currentVoice) return
  const audio = currentVoice
  currentVoice = null
  audio.pause()
  try { audio.currentTime = 0 } catch {}
}

function destroyVoiceBank() {
  haltVoice()
  if (!voiceBank) return
  voiceBank.list.forEach(a => {
    a.pause()
    a.removeAttribute('src')
    a.load()
  })
  voiceBank = null
}

function ensureVoiceBank() {
  const base = props.audioBase
  if (!base) {
    destroyVoiceBank()
    return
  }
  if (voiceBank?.key === base) return

  destroyVoiceBank()
  const list = []
  for (let i = 1; i <= 3; i++) {
    const a = new Audio()
    a.preload = 'auto'
    a.src = `${base}_${i}.webm`
    a.addEventListener('ended', () => {
      if (currentVoice === a) currentVoice = null
    })
    a.load()
    list.push(a)
  }
  voiceBank = { key: base, list, index: 0 }
}

function playVoiceLine() {
  if (!props.audioBase) return
  ensureVoiceBank()
  if (!voiceBank?.list.length) return

  haltVoice()
  const audio = voiceBank.list[voiceBank.index]
  voiceBank.index = (voiceBank.index + 1) % voiceBank.list.length
  currentVoice = audio

  try { audio.currentTime = 0 } catch {}
  audio.play().catch(() => {
    if (currentVoice === audio) currentVoice = null
  })
}

function getVoiceMotionAnimations() {
  const animations = player?.skeleton?.data?.animations || []
  // Use the exact base animations, as existing voice-enabled costumes do.
  // idle1/idle2/etc. are separate pose animations, not the voice interaction idle.
  const idle = animations.find(a => a.name.toLowerCase() === 'idle')
  const motion = animations.find(a => a.name.toLowerCase() === 'motion')
  return { idle, motion }
}

function isReadyForMotion() {
  if (!loaded || !player || !props.audioBase || !props.playing) return false
  if (props.datingTracks) return false
  if ((props.animation || '').toLowerCase() !== 'idle') return false

  const state = player.animationState
  const entry = state?.getCurrent(0)
  if (!state || !entry || entry.animation?.name?.toLowerCase() !== 'idle' || entry.next) return false

  return Boolean(getVoiceMotionAnimations().motion)
}

function hitTestCharacter(x, y) {
  const skel = player?.skeleton
  const cam = player?.sceneRenderer?.camera
  const rect = hostEl.value?.getBoundingClientRect()
  if (!skel || !cam || !rect?.width || !rect?.height) return false

  const nx = (x - rect.left) / rect.width
  const ny = (y - rect.top) / rect.height
  const worldX = (nx * 2 - 1) * (cam.viewportWidth / 2) * cam.zoom + cam.position.x
  const worldY = (1 - ny * 2) * (cam.viewportHeight / 2) * cam.zoom + cam.position.y

  const offset = new Vector2()
  const size = new Vector2()
  skel.getBounds(offset, size)
  return size.x > 0 && size.y > 0
    && worldX >= offset.x && worldX <= offset.x + size.x
    && worldY >= offset.y && worldY <= offset.y + size.y
}

function dropClickTracker() {
  window.removeEventListener('pointermove', onClickMove, true)
  window.removeEventListener('pointerup', onClickUp, true)
  window.removeEventListener('pointercancel', onClickCancel, true)
  clickTracker = null
}

function onClickMove(e) {
  if (!clickTracker || e.pointerId !== clickTracker.id || clickTracker.dragged) return
  const dist = Math.hypot(e.clientX - clickTracker.x, e.clientY - clickTracker.y)
  if (dist > CLICK_MOVE_LIMIT) clickTracker.dragged = true
}

function onClickUp(e) {
  if (!clickTracker || e.pointerId !== clickTracker.id) return
  const wasClick = !clickTracker.dragged
  const sameInstance = clickTracker.owner === player
  dropClickTracker()

  if (!wasClick || !sameInstance || !isReadyForMotion() || !hitTestCharacter(e.clientX, e.clientY)) return

  const state = player.animationState
  const { motion, idle } = getVoiceMotionAnimations()
  if (!motion || !idle) return

  state.setAnimation(0, motion.name, false)
  state.addAnimation(0, idle.name, true, motion.duration)
  playVoiceLine()
}

function onClickCancel(e) {
  if (e.pointerId === clickTracker?.id) dropClickTracker()
}

function onCharacterPointerDown(e) {
  if (e.button !== 0 || !e.isPrimary || !isReadyForMotion()) return
  dropClickTracker()
  clickTracker = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    dragged: false,
    owner: player,
  }
  window.addEventListener('pointermove', onClickMove, true)
  window.addEventListener('pointerup', onClickUp, true)
  window.addEventListener('pointercancel', onClickCancel, true)
}

function release() {
  dropClickTracker()
  destroyVoiceBank()
  loaded = false
  exportingAnimation = false
  cameraViewReady = false
  cameraZoomValue = 1
  cameraXValue = 0
  cameraYValue = 0
  originalCameraUpdate = null
  activeSkinName = ''
  hiddenLayers.clear()
  hiddenSlotAttachments.clear()
  if (wheelHandler) window.removeEventListener('wheel', wheelHandler, true)
  if (wheelAnimationFrame) cancelAnimationFrame(wheelAnimationFrame)
  wheelAnimationFrame = 0
  wheelAnchor = null
  wheelLastFrameTime = 0
  if (wheelCanvas && panHandlers) {
    wheelCanvas.removeEventListener('pointerdown', panHandlers.down)
    window.removeEventListener('pointermove', panHandlers.move, true)
    window.removeEventListener('pointerup', panHandlers.up, true)
    window.removeEventListener('pointercancel', panHandlers.up, true)
  }
  wheelCanvas = null
  wheelHandler = null
  panHandlers = null
  activePointerId = null
  lastPointer = null
  camera = null
  defaultCameraPosition = null
  if (player) {
    player.dispose()
    player = null
  }
  objectUrls.forEach((url) => URL.revokeObjectURL(url))
  objectUrls = []
  if (host) host.innerHTML = ''
}

function getAnimationNames(instance) {
  return instance.skeleton?.data?.animations?.map((item) => item.name)
    || instance.animationState?.data?.skeletonData?.animations?.map((item) => item.name)
    || []
}

function applyHiddenLayers(instance) {
  const slots = instance.skeleton?.slots || []
  let changed = false
  slots.forEach((slot) => {
    if (!slot.data?.name || !hiddenLayers.has(slot.data.name)) return
    const attachment = slot.getAttachment?.()
    if (!attachment) return
    hiddenSlotAttachments.set(slot, attachment)
    // Detaching is required for clipping attachments: alpha alone hides the
    // image but leaves the clipping polygon active for every following slot.
    slot.setAttachment(null)
    changed = true
  })
  return changed
}

function restoreVisibleLayerAttachments(instance) {
  const skeleton = instance?.skeleton
  if (!skeleton) return
  // Re-evaluate the current animation pose first so animated attachment
  // timelines restore the attachment belonging to the current frame.
  instance.animationState?.apply(skeleton)
  skeleton.slots.forEach((slot) => {
    if (hiddenLayers.has(slot.data?.name)) return
    if (!slot.getAttachment?.()) {
      const savedAttachment = hiddenSlotAttachments.get(slot)
      if (savedAttachment) slot.setAttachment(savedAttachment)
    }
    hiddenSlotAttachments.delete(slot)
  })
  applyHiddenLayers(instance)
  // The animation pose and attachments were changed after the player's
  // normal world-transform pass. Recompute transforms before the next draw.
  skeleton.updateWorldTransform()
}

function applyAnimation(instance, name, loop = true) {
  const state = instance.animationState
  if (state && props.datingTracks) {
    const mixIndex = /^mix(\d+)/i.exec(name)?.[1]
    const idleName = mixIndex ? 'idle' + mixIndex : ''
    const available = new Set(getAnimationNames(instance))
    state.clearTrack(0)
    state.clearTrack(1)
    instance.skeleton?.setToSetupPose()
    instance.skeleton?.updateWorldTransform()
    if (idleName && available.has(idleName) && available.has(name)) {
      state.setAnimation(0, idleName, true)
      state.setAnimation(1, name, loop)
      return true
    }
  } else if (state) {
    state.clearTrack(1)
  }
  if (state) {
    const definition = props.composites.find((entry) => entry?.name === name)
    const segments = definition?.composite || definition?.animations
    if (Array.isArray(segments) && segments.length) {
      const available = new Set(getAnimationNames(instance))
      // A composite can be a sequence of single animations or parallel layers.
      // A nested array represents animations that begin together on separate tracks.
      const definitions = new Map(props.composites.map((entry) => [entry?.name, entry]))
      const expandSegments = (items, ancestors = []) => {
        const expanded = []
        items.forEach((phase) => {
          if (Array.isArray(phase)) {
            const parallel = []
            const deferred = []
            phase.forEach((item) => {
              const nested = typeof item === 'string' ? definitions.get(item) : null
              if (nested && !ancestors.includes(item)) {
                const nestedItems = nested.composite || nested.animations || []
                const nestedGroups = expandSegments(nestedItems, [...ancestors, item])
                if (nestedGroups.length === 1) parallel.push(...nestedGroups[0])
                else deferred.push(...nestedGroups)
              } else {
                parallel.push(item)
              }
            })
            if (parallel.length) expanded.push(parallel)
            expanded.push(...deferred)
          } else {
            const nested = typeof phase === 'string' ? definitions.get(phase) : null
            if (nested && !ancestors.includes(phase)) {
              expanded.push(...expandSegments(nested.composite || nested.animations || [], [...ancestors, phase]))
            } else {
              expanded.push([phase])
            }
          }
        })
        return expanded
      }
      const groups = expandSegments(segments, [name])
      const startedTracks = new Set()
      let cursor = 0
      let scheduled = false

      state.clearTracks()
      groups.forEach((group) => {
        const layers = group.map((segment) =>
          typeof segment === 'string' ? { name: segment } : segment
        ).filter((segment) => segment?.name && available.has(segment.name))
          .sort((a, b) => (a.layerOrder ?? 0) - (b.layerOrder ?? 0))

        let groupDuration = 0
        layers.forEach((segment, trackIndex) => {
          const track = trackIndex
          const shouldLoop = Boolean(segment.loop)
          const entry = startedTracks.has(track)
            ? state.addAnimation(track, segment.name, shouldLoop, cursor)
            : state.setAnimation(track, segment.name, shouldLoop)
          startedTracks.add(track)
          const nativeDuration = entry?.animation?.duration || 0
          const duration = Number.isFinite(segment.playDuration) && segment.playDuration > 0
            ? Math.min(segment.playDuration, nativeDuration || segment.playDuration)
            : nativeDuration
          groupDuration = Math.max(groupDuration, duration)
          scheduled = true
        })
        cursor += groupDuration
      })

      if (scheduled) {
        if (loop) {
          const firstGroup = groups[0].map((segment) =>
            typeof segment === 'string' ? { name: segment } : segment
          ).filter((segment) => segment?.name && available.has(segment.name))
          firstGroup.forEach((segment, trackIndex) => {
            state.addAnimation(trackIndex, segment.name, true, cursor)
          })
        }
        return true
      }
    }
  }
  if (state) {
    state.clearTracks()
    state.setAnimation(0, name, loop)
    return true
  }
  instance.setAnimation(name, loop)
  return true
}

function isBackgroundSlot(name) {
  const normalized = String(name || '').toLowerCase()
  return normalized.startsWith('bg') || normalized.startsWith('bk')
    || normalized.includes(' bg') || normalized.includes('_bg')
    || normalized.includes('background')
}

function computeTrimmedBounds(skeleton) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let found = false

  for (const slot of skeleton.drawOrder || []) {
    if (!slot.bone?.active) continue
    if (isBackgroundSlot(slot.data?.name)) continue
    if (slot.color && slot.color.a <= 0) continue
    const attachment = slot.getAttachment?.()
    if (!attachment || attachment.color?.a <= 0 || typeof attachment.computeWorldVertices !== 'function') continue
    // Only renderable region/mesh attachments belong in visual bounds.
    // Bounding boxes, clipping polygons and paths can be much larger than the
    // costume itself and are not drawn as textured geometry.
    const isMesh = Number.isFinite(attachment.worldVerticesLength) && attachment.worldVerticesLength > 0
      && Boolean(attachment.region) && attachment.regionUVs?.length > 0
    const isRegion = !isMesh && Boolean(attachment.region) && attachment.offset?.length === 8
    if (!isMesh && !isRegion) continue
    const vertices = new Float32Array(isMesh ? attachment.worldVerticesLength : 8)
    try {
      if (isMesh) attachment.computeWorldVertices(slot, 0, attachment.worldVerticesLength, vertices, 0, 2)
      else attachment.computeWorldVertices(slot, vertices, 0, 2)
    } catch {
      continue
    }
    for (let i = 0; i < vertices.length; i += 2) {
      const x = vertices[i]
      const y = vertices[i + 1]
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      found = true
    }
  }

  if (!found || maxX <= minX || maxY <= minY) return null
  return {
    offset: new Vector2(minX, minY),
    size: new Vector2(maxX - minX, maxY - minY),
  }
}

function syncCameraToRenderer() {
  const renderCamera = player?.sceneRenderer?.camera
  if (!camera || !renderCamera) return
  if (camera.viewportWidth !== renderCamera.viewportWidth || camera.viewportHeight !== renderCamera.viewportHeight) {
    camera.setViewport(renderCamera.viewportWidth, renderCamera.viewportHeight)
  }
  camera.update()
  renderCamera.position.x = camera.position.x
  renderCamera.position.y = camera.position.y
  renderCamera.zoom = camera.zoom
  renderCamera.update()
}

function animateWheelZoom(timestamp) {
  if (!camera || !cameraViewReady || !wheelAnchor) { wheelAnimationFrame = 0; return }
  const elapsed = wheelLastFrameTime ? Math.max(0, timestamp - wheelLastFrameTime) : 16
  wheelLastFrameTime = timestamp
  // Exponential smoothing is frame-rate independent. Capping elapsed time made
  // zoom lag unpredictably on slower or temporarily busy frames.
  const easing = 1 - Math.exp(-elapsed / 75)
  const nextZoom = camera.zoom + (wheelTargetZoom - camera.zoom) * easing
  camera.zoom = Math.abs(wheelTargetZoom - nextZoom) < 0.00001 ? wheelTargetZoom : nextZoom
  camera.position.x = wheelAnchor.x - wheelAnchor.normalizedX * (camera.viewportWidth / 2) * camera.zoom
  camera.position.y = wheelAnchor.y - wheelAnchor.normalizedY * (camera.viewportHeight / 2) * camera.zoom
  cameraZoomValue = camera.zoom
  syncCameraToRenderer()
  emit('zoom', Math.round(defaultCameraZoom / cameraZoomValue * 100))
  if (camera.zoom !== wheelTargetZoom) wheelAnimationFrame = requestAnimationFrame(animateWheelZoom)
  else { wheelAnimationFrame = 0; wheelLastFrameTime = 0 }
}

function fitCameraToSkeleton(instance) {
  const skeleton = instance?.skeleton
  const renderCamera = instance?.sceneRenderer?.camera
  const canvas = instance?.canvas
  if (!skeleton || !renderCamera || !canvas) return false

  skeleton.updateWorldTransform()
  const trimmed = computeTrimmedBounds(skeleton)
  const offset = new Vector2()
  const size = new Vector2()
  let bounds = trimmed
  if (!bounds) {
    skeleton.getBounds(offset, size)
    if (Number.isFinite(size.x) && Number.isFinite(size.y) && size.x > 0 && size.y > 0) {
      bounds = { offset, size }
    }
  }
  if (!bounds || !Number.isFinite(bounds.offset.x) || !Number.isFinite(bounds.offset.y)
    || !Number.isFinite(bounds.size.x) || !Number.isFinite(bounds.size.y)
    || bounds.size.x <= 0 || bounds.size.y <= 0
    || bounds.size.x > 50000 || bounds.size.y > 50000) {
    console.warn('Unable to calculate visible Spine bounds; keeping the player viewport.', {
      skin: skeleton.skin?.name,
    })
    return false
  }

  // SpinePlayer calls its first renderer.resize() immediately after the
  // success callback. Use the same DPR-aware client dimensions here so the
  // initial fit does not depend on the canvas's pre-resize backing size.
  const dpr = window.devicePixelRatio || 1
  const viewportWidth = Math.max(1, Math.round((canvas.clientWidth || canvas.width / dpr) * dpr))
  const viewportHeight = Math.max(1, Math.round((canvas.clientHeight || canvas.height / dpr) * dpr))
  if (!camera) camera = new OrthoCamera(viewportWidth, viewportHeight)
  else camera.setViewport(viewportWidth, viewportHeight)

  // Fit the active skin's visible attachments. This runs after the selected
  // animation and skin have been applied, and again whenever a skin changes.
  const paddingX = Math.max(bounds.size.x * 0.06, 1)
  const paddingY = Math.max(bounds.size.y * 0.06, 1)
  camera.position.x = bounds.offset.x + bounds.size.x / 2
  camera.position.y = bounds.offset.y + bounds.size.y / 2
  camera.zoom = Math.max(
    (bounds.size.x + paddingX * 2) / viewportWidth,
    (bounds.size.y + paddingY * 2) / viewportHeight,
  )
  cameraZoomValue = camera.zoom
  defaultCameraZoom = camera.zoom
  defaultCameraPosition = { x: camera.position.x, y: camera.position.y }
  cameraXValue = camera.position.x
  cameraYValue = camera.position.y
  wheelTargetZoom = camera.zoom
  wheelAnchor = null
  if (wheelAnimationFrame) cancelAnimationFrame(wheelAnimationFrame)
  wheelAnimationFrame = 0
  wheelLastFrameTime = 0
  cameraViewReady = true
  syncCameraToRenderer()
  emit('zoom', 100)
  return true
}

function initializeCamera(instance) {
  const skeleton = instance.skeleton
  const canvas = instance.canvas
  const renderCamera = instance.sceneRenderer?.camera
  if (!skeleton || !canvas || !renderCamera) return ''

  skeleton.setToSetupPose()
  skeleton.updateWorldTransform()
  const skins = skeleton.data?.skins || []
  const preferredSkin = [props.skin, skeleton.skin?.name].find((name) =>
    name && skins.some((skin) => skin?.name === name)
  )
  let chosenSkin = ''

  if (preferredSkin) {
    skeleton.setSkinByName(preferredSkin)
    skeleton.setSlotsToSetupPose()
    skeleton.updateWorldTransform()
    const visibleBounds = computeTrimmedBounds(skeleton)
    const testOffset = new Vector2()
    const testSize = new Vector2()
    skeleton.getBounds(testOffset, testSize)
    if (visibleBounds || (Number.isFinite(testSize.x) && Number.isFinite(testSize.y)
      && testSize.x > 0 && testSize.y > 0 && testSize.x < 50000 && testSize.y < 50000)) {
      chosenSkin = preferredSkin
    }
  }

  if (!chosenSkin) {
    // Probe every available skin and choose a non-empty visible costume rather
    // than accepting the first skin whose broad setup bounds happen to be valid.
    let bestArea = -1
    for (const skin of skins) {
      const name = skin?.name
      if (!name) continue
      skeleton.setSkinByName(name)
      skeleton.setSlotsToSetupPose()
      skeleton.updateWorldTransform()
      const bounds = computeTrimmedBounds(skeleton)
      if (bounds) {
        const area = bounds.size.x * bounds.size.y
        if (Number.isFinite(area) && area > bestArea) {
          bestArea = area
          chosenSkin = name
        }
      } else {
        const testOffset = new Vector2()
        const testSize = new Vector2()
        skeleton.getBounds(testOffset, testSize)
        const area = testSize.x * testSize.y
        if (Number.isFinite(area) && testSize.x > 0 && testSize.y > 0
          && testSize.x < 50000 && testSize.y < 50000 && area > bestArea) {
          bestArea = area
          chosenSkin = name
        }
      }
    }
    chosenSkin ||= skins[0]?.name || ''
    if (chosenSkin) {
      skeleton.setSkinByName(chosenSkin)
      skeleton.setSlotsToSetupPose()
      skeleton.updateWorldTransform()
    }
  }

  camera = new OrthoCamera(renderCamera.viewportWidth || canvas.width, renderCamera.viewportHeight || canvas.height)
  cameraViewReady = false
  wheelCanvas = canvas
  panHandlers = {
    down: (event) => {
      if (event.button !== 0 || !event.isPrimary || !camera || !cameraViewReady) return
      event.preventDefault()
      // Stop an in-flight cursor-anchored zoom before starting a drag. Otherwise
      // its stale anchor can pull the character back while the user is panning.
      if (wheelAnimationFrame) cancelAnimationFrame(wheelAnimationFrame)
      wheelAnimationFrame = 0
      wheelAnchor = null
      wheelLastFrameTime = 0
      wheelTargetZoom = camera.zoom
      activePointerId = event.pointerId
      lastPointer = { x: event.clientX, y: event.clientY }
      canvas.classList.add('is-panning')
      try { canvas.setPointerCapture(event.pointerId) } catch { /* Pointer capture may be unavailable. */ }
    },
    move: (event) => {
      if (event.pointerId !== activePointerId || !lastPointer || !camera) return
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const deltaX = event.clientX - lastPointer.x
      const deltaY = event.clientY - lastPointer.y
      lastPointer = { x: event.clientX, y: event.clientY }
      const renderCamera = player?.sceneRenderer?.camera
      if (renderCamera && (camera.viewportWidth !== renderCamera.viewportWidth || camera.viewportHeight !== renderCamera.viewportHeight)) {
        camera.setViewport(renderCamera.viewportWidth, renderCamera.viewportHeight)
      }
      camera.position.x -= deltaX * camera.viewportWidth / rect.width * camera.zoom
      camera.position.y += deltaY * camera.viewportHeight / rect.height * camera.zoom
      cameraXValue = camera.position.x
      cameraYValue = camera.position.y
      syncCameraToRenderer()
    },
    up: (event) => {
      if (event.pointerId !== activePointerId) return
      activePointerId = null
      lastPointer = null
      canvas.classList.remove('is-panning')
    },
  }
  canvas.addEventListener('pointerdown', panHandlers.down)
  window.addEventListener('pointermove', panHandlers.move, true)
  window.addEventListener('pointerup', panHandlers.up, true)
  window.addEventListener('pointercancel', panHandlers.up, true)

  wheelHandler = (event) => {
    if (!camera || !cameraViewReady || !canvas.contains(event.target)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const renderCamera = player?.sceneRenderer?.camera
    if (renderCamera && (camera.viewportWidth !== renderCamera.viewportWidth || camera.viewportHeight !== renderCamera.viewportHeight)) {
      camera.setViewport(renderCamera.viewportWidth, renderCamera.viewportHeight)
    }
    const pointerX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const pointerY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    const normalizedX = pointerX * 2 - 1
    const normalizedY = 1 - pointerY * 2
    wheelAnchor = {
      x: camera.position.x + normalizedX * (camera.viewportWidth / 2) * camera.zoom,
      y: camera.position.y + normalizedY * (camera.viewportHeight / 2) * camera.zoom,
      normalizedX,
      normalizedY,
    }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1
    const delta = Math.max(-180, Math.min(180, event.deltaY * unit))
    wheelTargetZoom = Math.min(defaultCameraZoom * 4, Math.max(defaultCameraZoom * 0.08, wheelTargetZoom * Math.exp(delta * 0.00125)))
    if (!wheelAnimationFrame) {
      wheelLastFrameTime = 0
      wheelAnimationFrame = requestAnimationFrame(animateWheelZoom)
    }
  }
  window.addEventListener('wheel', wheelHandler, { passive: false, capture: true })
  return chosenSkin
}

function restoreActiveSkin(instance) {
  const skeleton = instance?.skeleton
  if (!skeleton || !activeSkinName) return
  const exists = (skeleton.data?.skins || []).some((skin) => skin?.name === activeSkinName)
  if (!exists) return
  skeleton.setSkinByName(activeSkinName)
  skeleton.setSlotsToSetupPose()
  skeleton.updateWorldTransform()
}

function handleSuccess(instance, token) {
  if (token !== loadToken) return
  loaded = true
  camera = instance.sceneRenderer?.camera || null
  activeSkinName = initializeCamera(instance) || ''
  if (instance.speed !== undefined) instance.speed = props.speed

  const names = getAnimationNames(instance)
  emit('animations', names)
  const skinNames = props.datingTracks
    ? (instance.skeleton?.data?.skins || []).map((item) => item?.name).filter(Boolean)
    : []
  const initialSkin = skinNames.find((name) => name === instance.skeleton?.skin?.name) || skinNames[0] || ''
  emit('skins', skinNames, initialSkin)
  emit('layers', (instance.skeleton?.slots || []).map((slot) => slot.data?.name).filter(Boolean))

  const initial = props.firstAnimation
    ? names[0]
    : props.datingTracks
      ? names.find((name) => /^mix\d+$/i.test(name)) || names.find((name) => name.toLowerCase() === 'idle') || names[0]
      : names.find((name) => name.toLowerCase() === 'idle') || names[0]
  if (initial) applyAnimation(instance, initial, props.loop)
  restoreActiveSkin(instance)
  if (instance.animationState && instance.skeleton) {
    instance.animationState.apply(instance.skeleton)
    instance.skeleton.updateWorldTransform()
  }
  applyHiddenLayers(instance)
  fitCameraToSkeleton(instance)
  ensureVoiceBank()

  if (props.playing) instance.play()
  else instance.pause()

  emit('ready')
}

function handleError(token, reason) {
  if (token !== loadToken) return
  const message = typeof reason === 'string'
    ? reason
    : reason?.message || String(reason || 'Не удалось загрузить Spine-ресурсы.')
  emit('error', message)
}

function createPlayer(config, token) {
  player = new SpinePlayer(host, {
    showControls: false,
    showLoading: true,
    backgroundColor: '00000000',
    preserveDrawingBuffer: true,
    // BrownDust2 atlases use straight alpha (no pma:true in the atlas header).
    // Match the WebGL blend mode to the source texture data to avoid bright halos.
    premultipliedAlpha: false,
    alpha: true,
    ...config,
    viewport: {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      padLeft: 0,
      padRight: 0,
      padTop: 50,
      padBottom: 50,
      transitionTime: 0,
    },
    update: (instance) => {
      // Spine Player resets its renderer camera from the viewport every frame.
      // Re-apply our user camera only after that reset, while tracking resizes.
      if (camera && cameraViewReady) syncCameraToRenderer()
      // Animation timelines can rewrite slot colors every frame. Re-apply
      // hidden layers after the pose is evaluated and before Spine draws it.
      applyHiddenLayers(instance)
    },
    success: (instance) => {
      handleSuccess(instance, token)

    },
    draw: (instance, delta) => {
      if (typeof config.draw === 'function') config.draw(instance, delta)
    },
    error: (_instance, reason) => handleError(token, reason),
  })
}

async function load() {
  if (!host || (!props.files?.length && !props.assetBase)) return
  const token = ++loadToken
  release()

  if (!props.files?.length && props.assetBase) {
    const base = props.assetBase.replace(/\/$/, '')
    try {
      createPlayer({
        binaryUrl: `${base}.skel`,
        atlasUrl: `${base}.atlas`,
      }, token)
    } catch (error) {
      handleError(token, error)
    }
    return
  }

  const atlas = props.files.find((file) => file.name.toLowerCase().endsWith('.atlas'))
  const skeleton = props.files.find((file) => /\.(skel|json)$/i.test(file.name))
  const textures = props.files.filter((file) => file.name.toLowerCase().endsWith('.png'))

  if (!atlas || !skeleton || !textures.length) {
    emit('error', 'Для этого Spine-комплекта нужны .atlas, .skel/.json и связанные PNG-текстуры.')
    return
  }

  try {
    const atlasText = await atlas.text()
    const referenced = [...atlasText.matchAll(/^([^\s]+\.png)\s*$/gim)].map((match) => match[1])
    const missing = referenced.filter((name) => !textures.some((file) => file.name.toLowerCase() === name.toLowerCase()))
    if (missing.length) {
      emit('error', 'В атласе указаны отсутствующие PNG-текстуры: ' + missing.join(', '))
      return
    }

    const skeletonUrl = makeObjectUrl(skeleton)
    const atlasUrl = makeObjectUrl(atlas)
    const baseUrl = atlasUrl.slice(0, atlasUrl.lastIndexOf('/') + 1)
    const rawDataURIs = Object.fromEntries(
      textures.map((file) => [baseUrl + file.name, makeObjectUrl(file)]),
    )

    if (token !== loadToken) return

    const isJson = skeleton.name.toLowerCase().endsWith('.json')
    createPlayer({
      ...(isJson ? { jsonUrl: skeletonUrl } : { binaryUrl: skeletonUrl }),
      atlasUrl,
      rawDataURIs,
    }, token)
  } catch (error) {
    handleError(token, error)
  }
}

watch(() => props.animation, (name) => {
  haltVoice()
  dropClickTracker()
  if (!loaded || !player || !name) return
  applyAnimation(player, name, props.loop)
  restoreActiveSkin(player)
  if (player.animationState && player.skeleton) {
    player.animationState.apply(player.skeleton)
    player.skeleton.updateWorldTransform()
  }
  applyHiddenLayers(player)
  // Ultimate/cutscene animations can have a very different opening pose and
  // framing from the animation used when the asset was first loaded.
  // Recalculate the initial camera bounds for each selected animation.
  fitCameraToSkeleton(player)
  player.drawFrame?.(false)
  if (props.playing) player.play()
})

function applySelectedSkin(instance, skinName) {
  const skeleton = instance?.skeleton
  if (!props.datingTracks || !skeleton || !skinName) return
  const available = (skeleton.data?.skins || []).some((item) => item?.name === skinName)
  if (!available || skeleton.skin?.name === skinName) return
  activeSkinName = skinName
  skeleton.setSkinByName(skinName)
  skeleton.setSlotsToSetupPose()
  if (props.animation) applyAnimation(instance, props.animation, props.loop)
  instance.animationState?.apply(skeleton)
  applyHiddenLayers(instance)
  skeleton.updateWorldTransform()
  fitCameraToSkeleton(instance)
  instance.drawFrame?.(false)
}

watch(() => props.skin, (skinName) => {
  if (!props.datingTracks || !loaded || !player || !skinName) return
  applySelectedSkin(player, skinName)
})

watch(() => props.playing, (value) => {
  if (!value) haltVoice()
  if (!loaded || !player) return
  if (value) player.play()
  else player.pause()
})

watch(() => props.loop, (value) => {
  if (!loaded || !player || !props.animation) return
  applyAnimation(player, props.animation, value)
  restoreActiveSkin(player)
  applyHiddenLayers(player)
})

watch(() => props.audioBase, () => {
  dropClickTracker()
  ensureVoiceBank()
})

watch(() => props.speed, (value) => {
  if (player) player.speed = value
})

function updateProgress() {
  if (!exportingAnimation && player?.animationState) {
    const state = player.animationState
    const entry = state.getCurrent(1) || state.getCurrent(0)
    const duration = entry?.animation?.duration
    if (entry && Number.isFinite(duration) && duration > 0) {
      const currentTime = ((entry.trackTime % duration) + duration) % duration
      emit('progress', currentTime / duration)
      emit('duration', duration)
    }
  }
  progressFrame = requestAnimationFrame(updateProgress)
}

function seek(progress) {
  if (!player?.animationState) return
  const state = player.animationState
  const entry = state.getCurrent(1) || state.getCurrent(0)
  const duration = entry?.animation?.duration
  if (!entry || !Number.isFinite(duration) || duration <= 0) return
  entry.trackTime = Math.max(0, Math.min(duration, progress * duration))
  state.apply(player.skeleton)
  player.skeleton.updateWorldTransform()
}
function setZoom(value) {
  if (!camera || !cameraViewReady) return
  if (wheelAnimationFrame) cancelAnimationFrame(wheelAnimationFrame)
  wheelAnimationFrame = 0
  wheelAnchor = null
  wheelLastFrameTime = 0
  camera.zoom = Math.min(defaultCameraZoom * 4, Math.max(defaultCameraZoom * 0.08, value))
  wheelTargetZoom = camera.zoom
  cameraZoomValue = camera.zoom
  syncCameraToRenderer()
  emit('zoom', Math.round(defaultCameraZoom / cameraZoomValue * 100))
}

function zoomIn() { if (camera) setZoom(cameraZoomValue / 1.2) }
function zoomOut() { if (camera) setZoom(cameraZoomValue * 1.2) }
function resetView() {
  if (!camera || !defaultCameraPosition) return
  camera.position.x = defaultCameraPosition.x
  camera.position.y = defaultCameraPosition.y
  camera.zoom = defaultCameraZoom
  wheelTargetZoom = defaultCameraZoom
  if (wheelAnimationFrame) cancelAnimationFrame(wheelAnimationFrame)
  wheelAnimationFrame = 0
  wheelAnchor = null
  wheelLastFrameTime = 0
  cameraZoomValue = defaultCameraZoom
  cameraXValue = defaultCameraPosition.x
  cameraYValue = defaultCameraPosition.y
  syncCameraToRenderer()
  emit('zoom', 100)
}

function setLayerVisible(name, visible) {
  if (visible) hiddenLayers.delete(name)
  else hiddenLayers.add(name)
  if (player) {
    if (visible) restoreVisibleLayerAttachments(player)
    else applyHiddenLayers(player)
  }
}
function setAllLayersVisible(visible, names = []) {
  names.forEach((name) => {
    if (visible) hiddenLayers.delete(name)
    else hiddenLayers.add(name)
  })
  ;(player?.skeleton?.slots || []).forEach((slot) => {
    const name = slot.data?.name
    if (!name) return
    if (visible) hiddenLayers.delete(name)
    else hiddenLayers.add(name)
  })
  if (player) {
    if (visible) restoreVisibleLayerAttachments(player)
    else applyHiddenLayers(player)
  }
}
async function saveScreenshot(transparent = false) {
  const instance = player
  const canvas = instance?.canvas
  const cam = camera
  const gl = instance?.context?.gl
  const renderer = instance?.sceneRenderer
  if (!instance || !canvas || !cam || !renderer || !gl || !canvas.width || !canvas.height) {
    throw new Error('Spine renderer is not ready for screenshot export.')
  }

  const prevPosX = cam.position.x
  const prevPosY = cam.position.y
  const prevZoom = cam.zoom
  const prevWidth = canvas.width
  const prevHeight = canvas.height
  const prevStyleWidth = canvas.style.getPropertyValue('width')
  const prevStyleHeight = canvas.style.getPropertyValue('height')
  const prevStyleWidthPriority = canvas.style.getPropertyPriority('width')
  const prevStyleHeightPriority = canvas.style.getPropertyPriority('height')
  const dpr = window.devicePixelRatio || 1

  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0
  const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || maxTextureSize
  const maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [maxRenderbufferSize, maxRenderbufferSize]
  const maxSupportedSize = Math.min(maxTextureSize, maxRenderbufferSize, maxViewportDims[0], maxViewportDims[1])
  if (maxSupportedSize < 3000) {
    throw new Error(`This device supports only ${maxSupportedSize}px screenshots; 3000×3000 export is unavailable.`)
  }
  const targetSize = 3000
  const scaleW = targetSize / prevWidth
  const scaleH = targetSize / prevHeight
  // Render the square export viewport at full resolution without letterboxing.
  const scale = Math.max(scaleW, scaleH) || 1
  const previousBackground = instance.config?.backgroundColor || '#171720'
  const previousDomBackground = instance.dom?.style.backgroundColor || ''
  const previousCanvasBackground = canvas.style.backgroundColor || ''
  const previousBgColor = String(previousBackground).replace(/^#/, '')
  const setTransparentBackground = (enabled) => {
    const color = enabled ? '00000000' : previousBgColor
    if (instance.config) instance.config.backgroundColor = enabled ? '00000000' : previousBackground
    instance.bg?.setFromString?.(color)
    if (instance.dom) instance.dom.style.backgroundColor = enabled ? 'transparent' : previousDomBackground
    canvas.style.backgroundColor = enabled ? 'transparent' : previousCanvasBackground
  }
  const safeName = value => String(value || '').trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '')
  const characterId = props.assetBase.match(/\/(\d{6})\//)?.[1] || 'character'
  const animationName = safeName(props.animation) || 'preview'
  const filename = `BD2_Studio_${characterId}_${animationName}.png`

  let screenshotBlobPromise

  try {
    if (!props.useCurrentCamera && defaultCameraPosition) {
      cam.position.x = defaultCameraPosition.x
      cam.position.y = defaultCameraPosition.y
    }
    // Preserve the current screen-space zoom while increasing the render viewport to 3000×3000.
    cam.zoom = prevZoom / scale
    cam.update()
    setTransparentBackground(transparent)

    canvas.style.setProperty('width', `${targetSize / dpr}px`, 'important')
    canvas.style.setProperty('height', `${targetSize / dpr}px`, 'important')
    canvas.width = targetSize
    canvas.height = targetSize
    renderer.resize(targetSize, targetSize)

    if (canvas.width !== targetSize || canvas.height !== targetSize) {
      throw new Error(`High-resolution render was reduced to ${canvas.width}×${canvas.height}; the image was not exported.`)
    }

    const renderCamera = renderer.camera
    if (renderCamera) {
      renderCamera.position.x = cam.position.x
      renderCamera.position.y = cam.position.y
      renderCamera.zoom = cam.zoom
      renderCamera.update()
    }
    instance.drawFrame?.(false)

    if (canvas.width !== targetSize || canvas.height !== targetSize) {
      throw new Error(`Spine redraw changed the export size to ${canvas.width}×${canvas.height}; the image was not exported.`)
    }

    const screenshotCanvas = document.createElement('canvas')
    screenshotCanvas.width = targetSize
    screenshotCanvas.height = targetSize
    const context = screenshotCanvas.getContext('2d')
    if (!context) throw new Error('Could not create a screenshot canvas.')
    if (!transparent) {
      context.fillStyle = backgroundColor.value
      context.fillRect(0, 0, targetSize, targetSize)
      const bgImage = backgroundImageElement.value
      if (bgImage?.complete && bgImage.naturalWidth) {
        const box = backgroundImageRect.value
        const destX = box.x / 100 * targetSize
        const destY = box.y / 100 * targetSize
        const destWidth = box.width / 100 * targetSize
        const destHeight = box.height / 100 * targetSize
        // Match object-fit: cover: keep the uploaded image's proportions and
        // crop its excess instead of stretching it into the square export box.
        const sourceAspect = bgImage.naturalWidth / bgImage.naturalHeight
        const destAspect = destWidth / destHeight
        if (sourceAspect > destAspect) {
          const sourceWidth = bgImage.naturalHeight * destAspect
          const sourceX = (bgImage.naturalWidth - sourceWidth) / 2
          context.drawImage(bgImage, sourceX, 0, sourceWidth, bgImage.naturalHeight,
            destX, destY, destWidth, destHeight)
        } else {
          const sourceHeight = bgImage.naturalWidth / destAspect
          const sourceY = (bgImage.naturalHeight - sourceHeight) / 2
          context.drawImage(bgImage, 0, sourceY, bgImage.naturalWidth, sourceHeight,
            destX, destY, destWidth, destHeight)
        }
      }
    }
    context.drawImage(canvas, 0, 0, targetSize, targetSize)

    // Encode asynchronously, restoring the live preview before the browser paints.
    screenshotBlobPromise = new Promise((resolve, reject) => {
      screenshotCanvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode the PNG screenshot.')), 'image/png')
    })
  } finally {
    canvas.width = prevWidth
    canvas.height = prevHeight
    if (prevStyleWidth) canvas.style.setProperty('width', prevStyleWidth, prevStyleWidthPriority)
    else canvas.style.removeProperty('width')
    if (prevStyleHeight) canvas.style.setProperty('height', prevStyleHeight, prevStyleHeightPriority)
    else canvas.style.removeProperty('height')
    renderer.resize(prevWidth, prevHeight)

    cam.position.x = prevPosX
    cam.position.y = prevPosY
    cam.zoom = prevZoom
    cam.update()
    setTransparentBackground(false)
    const renderCamera = renderer.camera
    if (renderCamera) {
      renderCamera.position.x = cam.position.x
      renderCamera.position.y = cam.position.y
      renderCamera.zoom = cam.zoom
      renderCamera.update()
    }
    instance.drawFrame?.(false)
  }

  const blob = await screenshotBlobPromise
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}


function drawExportFrame(context, width, height, sourceCanvas, transparent) {
  context.clearRect(0, 0, width, height)
  if (!transparent) {
    context.fillStyle = backgroundColor.value
    context.fillRect(0, 0, width, height)
    const image = backgroundImageElement.value
    if (image?.complete && image.naturalWidth) {
      const box = backgroundImageRect.value
      const destX = box.x / 100 * width
      const destY = box.y / 100 * height
      const destWidth = box.width / 100 * width
      const destHeight = box.height / 100 * height
      if (destWidth > 0 && destHeight > 0) {
        const sourceAspect = image.naturalWidth / image.naturalHeight
        const destAspect = destWidth / destHeight
        if (sourceAspect > destAspect) {
          const sourceWidth = image.naturalHeight * destAspect
          const sourceX = (image.naturalWidth - sourceWidth) / 2
          context.drawImage(image, sourceX, 0, sourceWidth, image.naturalHeight,
            destX, destY, destWidth, destHeight)
        } else {
          const sourceHeight = image.naturalWidth / destAspect
          const sourceY = (image.naturalHeight - sourceHeight) / 2
          context.drawImage(image, 0, sourceY, image.naturalWidth, sourceHeight,
            destX, destY, destWidth, destHeight)
        }
      }
    }
  }
  context.drawImage(sourceCanvas, 0, 0, width, height)
}

function downloadExportBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function getExportAnimationDuration(instance) {
  const state = instance.animationState
  if (!state) return 3

  if (props.datingTracks) {
    const active = state.getCurrent(1) || state.getCurrent(0)
    return active?.animation?.duration || 3
  }

  const composite = props.composites.find((entry) => entry?.name === props.animation)
  if (composite && (composite.composite || composite.animations)) {
    let maxEnd = 0
    ;(state.tracks || []).forEach((track) => {
      let entry = track
      let start = 0
      let guard = 0
      while (entry && guard++ < 100) {
        const duration = Number(entry.animation?.duration) || 0
        maxEnd = Math.max(maxEnd, start + duration)
        const next = entry.next
        if (!next) break
        const delay = Number(next.delay)
        start = Number.isFinite(delay) ? Math.max(start + duration, delay) : start + duration
        entry = next
      }
    })
    return maxEnd || 3
  }

  const animation = state.data?.skeletonData?.animations?.find((entry) => entry.name === props.animation)
  return animation?.duration || state.getCurrent(0)?.animation?.duration || 3
}

async function exportAnimation(format, transparent = false) {
  const instance = player
  const canvas = instance?.canvas
  const cam = camera
  const renderer = instance?.sceneRenderer
  const state = instance?.animationState
  const skeleton = instance?.skeleton
  if (!instance || !canvas || !cam || !renderer || !state || !skeleton || !canvas.width || !canvas.height) {
    throw new Error('Spine renderer is not ready for animation export.')
  }
  if (!['frames', 'webm', 'gif'].includes(format)) throw new Error('Unsupported animation export format.')
  if (exportingAnimation) return

  haltVoice()
  exportingAnimation = true
  const wasPlaying = props.playing
  const previousCamera = { x: cam.position.x, y: cam.position.y, zoom: cam.zoom }
  const previousBackground = instance.config?.backgroundColor || '#171720'
  const previousDomBackground = instance.dom?.style.backgroundColor || ''
  const previousCanvasBackground = canvas.style.backgroundColor || ''
  const fps = format === 'gif' ? 20 : 60
  const speed = Math.max(0.01, Number(instance.speed) || Number(props.speed) || 1)
  const stepDuration = (1 / fps) * speed
  const safeName = (value) => String(value || '').trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '')
  const characterId = props.assetBase.match(/\/(\d{6})\//)?.[1] || 'character'
  const animationName = safeName(props.animation) || 'animation'
  const baseName = `BD2_Studio_${characterId}_${animationName}`
  const setTransparentBackground = (enabled) => {
    const color = enabled ? '00000000' : String(previousBackground).replace(/^#/, '')
    if (instance.config) instance.config.backgroundColor = enabled ? '00000000' : previousBackground
    instance.bg?.setFromString?.(color)
    if (instance.dom) instance.dom.style.backgroundColor = enabled ? 'transparent' : previousDomBackground
    canvas.style.backgroundColor = enabled ? 'transparent' : previousCanvasBackground
  }

  let output = null
  let outputTarget = null
  try {
    if (!props.useCurrentCamera && defaultCameraPosition) {
      cam.position.x = defaultCameraPosition.x
      cam.position.y = defaultCameraPosition.y
      cam.zoom = defaultCameraZoom
      cam.update()
    }
    const renderCamera = renderer.camera
    if (renderCamera) {
      renderCamera.position.x = cam.position.x
      renderCamera.position.y = cam.position.y
      renderCamera.zoom = cam.zoom
      renderCamera.update()
    }

    setTransparentBackground(transparent)
    applyAnimation(instance, props.animation, false)
    restoreActiveSkin(instance)
    applyHiddenLayers(instance)
    state.apply(skeleton)
    skeleton.updateWorldTransform()
    instance.pause()

    const duration = getExportAnimationDuration(instance)
    const totalFrames = Math.max(1, Math.ceil(duration / stepDuration - 1e-7))
    const frameCanvas = document.createElement('canvas')
    frameCanvas.width = canvas.width
    frameCanvas.height = canvas.height
    const context = frameCanvas.getContext('2d')
    if (!context) throw new Error('Could not create an animation export canvas.')

    let zip = null
    let videoSource = null
    let gifEncoder = null
    let gifPalette = null
    let gifLookup = null
    if (format === 'frames') {
      zip = new JSZip()
    } else if (format === 'gif') {
      const sampleCanvas=document.createElement('canvas')
      const sampleContext=sampleCanvas.getContext('2d',{willReadFrequently:true})
      if(!sampleContext)throw new Error('Could not create the GIF palette sampling canvas.')
      const samples=[]
      for(let frame=0;frame<totalFrames;frame++){
        if(player!==instance)throw new Error('The selected character changed during export.')
        instance.drawFrame?.(false);drawExportFrame(context,frameCanvas.width,frameCanvas.height,canvas,transparent)
        samples.push(createGifSample(frameCanvas,sampleCanvas,sampleContext))
        emit('progress',((frame+1)/totalFrames)*0.4)
        if(frame<totalFrames-1){state.update(stepDuration);state.apply(skeleton);skeleton.updateWorldTransform()}
        if(frame%8===7)await new Promise(resolve=>requestAnimationFrame(resolve))
      }
      gifPalette=createGifPalette(samples,transparent)
      const visiblePalette=transparent?gifPalette.slice(1):gifPalette
      gifLookup=createPaletteLookup(visiblePalette)
      gifEncoder=GIFEncoder({initialCapacity:Math.max(1<<20,frameCanvas.width*frameCanvas.height)})
      applyAnimation(instance,props.animation,false);restoreActiveSkin(instance);applyHiddenLayers(instance)
      state.apply(skeleton);skeleton.updateWorldTransform()
    } else {
      const quality = new Quality({ bitrate: 10000000 })
      const encodingOptions = {
        width: frameCanvas.width,
        height: frameCanvas.height,
        quality,
        alpha: transparent ? 'keep' : 'discard',
      }
      let codec = null
      for (const candidate of ['vp9', 'vp8']) {
        if (await canEncodeVideo(candidate, encodingOptions)) {
          codec = candidate
          break
        }
      }
      if (!codec) throw new Error('This browser cannot encode WebM at the current video size.')
      outputTarget = new BufferTarget()
      output = new Output({ format: new WebMOutputFormat(), target: outputTarget })
      videoSource = new CanvasSource(frameCanvas, {
        codec,
        quality,
        alpha: encodingOptions.alpha,
      })
      output.addVideoTrack(videoSource, { frameRate: fps })
      await output.start()
    }

    if(format!=='gif'){
      for(let frame=0;frame<totalFrames;frame++){
        if(player!==instance)throw new Error('The selected character changed during export.')
        instance.drawFrame?.(false);drawExportFrame(context,frameCanvas.width,frameCanvas.height,canvas,transparent)
        if(format==='frames'){
          const blob=await new Promise((resolve,reject)=>frameCanvas.toBlob(value=>value?resolve(value):reject(new Error('Could not encode animation frame.')),'image/png'))
          zip.file(`frame_${String(frame).padStart(4,'0')}.png`,blob)
        }else await videoSource.add(frame/fps,1/fps)
        emit('progress',(frame+1)/totalFrames);emit('duration',duration)
        if(frame<totalFrames-1){state.update(stepDuration);state.apply(skeleton);skeleton.updateWorldTransform()}
        if(frame%5===4)await new Promise(resolve=>requestAnimationFrame(resolve))
      }
    }else{
      const visiblePalette=transparent?gifPalette.slice(1):gifPalette
      for(let frame=0;frame<totalFrames;frame++){
        if(player!==instance)throw new Error('The selected character changed during export.')
        instance.drawFrame?.(false);drawExportFrame(context,frameCanvas.width,frameCanvas.height,canvas,transparent)
        const imageData=context.getImageData(0,0,frameCanvas.width,frameCanvas.height)
        const indices=ditherGifFrame(imageData,visiblePalette,gifLookup,transparent)
        const options={delay:50}
        if(frame===0){options.palette=gifPalette;options.repeat=0;if(transparent){options.transparent=true;options.transparentIndex=0}}
        gifEncoder.writeFrame(indices,frameCanvas.width,frameCanvas.height,options)
        emit('progress',0.4+((frame+1)/totalFrames)*0.6);emit('duration',duration)
        if(frame<totalFrames-1){state.update(stepDuration);state.apply(skeleton);skeleton.updateWorldTransform()}
        if(frame%3===2)await new Promise(resolve=>requestAnimationFrame(resolve))
      }
    }

    if (format === 'frames') {
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadExportBlob(blob, `${baseName}_frames.zip`)
    } else if (format === 'gif') {
      gifEncoder.finish()
downloadExportBlob(new Blob([gifEncoder.bytes()], { type: 'image/gif' }), `${baseName}.gif`)
    } else {
      await output.finalize()
      if (!outputTarget.buffer) throw new Error('WebM encoding did not produce a video file.')
      downloadExportBlob(new Blob([outputTarget.buffer], { type: 'video/webm' }), `${baseName}.webm`)
    }
    emit('progress', 1)
  } finally {
    exportingAnimation = false
    if (player === instance) {
      cam.position.x = previousCamera.x
      cam.position.y = previousCamera.y
      cam.zoom = previousCamera.zoom
      cam.update()
      const renderCamera = renderer.camera
      if (renderCamera) {
        renderCamera.position.x = cam.position.x
        renderCamera.position.y = cam.position.y
        renderCamera.zoom = cam.zoom
        renderCamera.update()
      }
      if (instance.config) instance.config.backgroundColor = previousBackground
      instance.bg?.setFromString?.(String(previousBackground).replace(/^#/, ''))
      if (instance.dom) instance.dom.style.backgroundColor = previousDomBackground
      canvas.style.backgroundColor = previousCanvasBackground
      applyAnimation(instance, props.animation, props.loop)
      restoreActiveSkin(instance)
      applyHiddenLayers(instance)
      state.apply(skeleton)
      skeleton.updateWorldTransform()
      instance.drawFrame?.(false)
      if (wasPlaying) instance.play()
      else instance.pause()
    }
    emit('progress', 0)
  }
}

const backgroundColor = ref('#171720')
const colorMode = ref('HEX')
const colorPickerOpen = ref(false)
const colorPickerButtonEl = ref(null)
const colorPickerPopoverEl = ref(null)
const backgroundImageEditMode = ref(false)
const backgroundImage = ref('')
const backgroundImageElement = ref(null)
const backgroundImageRect = ref({ x: 0, y: 0, width: 100, height: 100 })
const backgroundLayerEl = ref(null)
const imageFileInput = ref(null)
let backgroundObjectUrl = ''
let imagePointerAction = null
let imagePointerStart = null
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)) }
function hexToRgb(hex) {
  const value = String(hex || '').replace('#', '')
  const full = value.length === 3 ? value.split('').map(x => x + x).join('') : value
  const number = Number.parseInt(full, 16)
  return Number.isFinite(number) ? { r: number >> 16 & 255, g: number >> 8 & 255, b: number & 255 } : { r: 23, g: 23, b: 32 }
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0, s = 0, l = (max + min) / 2
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  return { h: Math.round((h + 360) % 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}
function hslToRgb(h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }
}
const rgbColor = () => hexToRgb(backgroundColor.value)
const hslColor = () => rgbToHsl(...Object.values(rgbColor()))
const pickerHue = ref(0)
function setRgbColor(r, g, b) {
  backgroundColor.value = '#' + [r, g, b].map(v => clamp(Math.round(Number(v) || 0), 0, 255).toString(16).padStart(2, '0')).join('')
  const hsv = rgbToHsv(...Object.values(rgbColor()))
  if (hsv.s > 0) pickerHue.value = hsv.h
}
function setHslColor(h, s, l) {
  const rgb = hslToRgb((Number(h) || 0) % 360, clamp(Number(s) || 0, 0, 100), clamp(Number(l) || 0, 0, 100))
  setRgbColor(rgb.r, rgb.g, rgb.b)
}
function updateHexColor(value) {
  const normalized = value.startsWith('#') ? value : '#' + value
  if (/^#[0-9a-f]{6}$/i.test(normalized)) backgroundColor.value = normalized.toLowerCase()
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
  let h = 0
  if (delta) {
    if (max === r) h = 60 * (((g - b) / delta) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : delta / max * 100, v: max * 100 }
}
function hsvToRgb(h, s, v) {
  s /= 100; v /= 100
  const chroma = v * s
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1))
  const m = v - chroma
  let rgb
  if (h < 60) rgb = [chroma, x, 0]
  else if (h < 120) rgb = [x, chroma, 0]
  else if (h < 180) rgb = [0, chroma, x]
  else if (h < 240) rgb = [0, x, chroma]
  else if (h < 300) rgb = [x, 0, chroma]
  else rgb = [chroma, 0, x]
  return rgb.map(value => Math.round((value + m) * 255))
}
const hsvColor = () => rgbToHsv(...Object.values(rgbColor()))
const hueSquareEl = ref(null)
let colorPointerActive = false
let colorPointerMode = 'square'
function setHsvColor(h, s, v) {
  pickerHue.value = (Number(h) + 360) % 360
  const [r, g, b] = hsvToRgb(pickerHue.value, clamp(Number(s), 0, 100), clamp(Number(v), 0, 100))
  setRgbColor(r, g, b)
}
function updateSquareFromPointer(event) {
  const rect = hueSquareEl.value?.getBoundingClientRect()
  if (!rect) return
  const s = clamp((event.clientX - rect.left) / rect.width * 100, 0, 100)
  const v = 100 - clamp((event.clientY - rect.top) / rect.height * 100, 0, 100)
  setHsvColor(pickerHue.value, s, v)
}
function startSquareAdjust(event) {
  event.preventDefault()
  colorPointerActive = true
  colorPointerMode = 'square'
  updateSquareFromPointer(event)
  window.addEventListener('pointermove', moveColorPicker)
  window.addEventListener('pointerup', stopColorPicker, { once: true })
  window.addEventListener('pointercancel', stopColorPicker, { once: true })
}
function moveColorPicker(event) {
  if (colorPointerActive && colorPointerMode === 'square') updateSquareFromPointer(event)
}
function stopColorPicker() {
  colorPointerActive = false
  window.removeEventListener('pointermove', moveColorPicker)
}
function setHueFromSlider(value) {
  const hsv = hsvColor()
  setHsvColor(Number(value), hsv.s, hsv.v)
}
function resetBackgroundColor() {
  backgroundColor.value = '#171720'
}
function openImagePicker() { imageFileInput.value?.click() }
function handlePreviewPointerDown(event) {
  if (!colorPickerOpen.value) return
  if (colorPickerButtonEl.value?.contains(event.target) || colorPickerPopoverEl.value?.contains(event.target)) return
  colorPickerOpen.value = false
}
function loadBackgroundImage(event) {
  const file = event.target.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  if (backgroundObjectUrl) URL.revokeObjectURL(backgroundObjectUrl)
  backgroundObjectUrl = URL.createObjectURL(file)
  backgroundImage.value = backgroundObjectUrl
  backgroundImageRect.value = { x: 0, y: 0, width: 100, height: 100 }
  backgroundImageEditMode.value = true
  event.target.value = ''
}
function clearBackgroundImage() {
  backgroundImage.value = ''
  backgroundImageEditMode.value = false
  if (backgroundObjectUrl) URL.revokeObjectURL(backgroundObjectUrl)
  backgroundObjectUrl = ''
}
function beginImageTransform(event, action) {
  event.preventDefault()
  event.stopPropagation()
  const rect = backgroundLayerEl.value?.getBoundingClientRect()
  if (!rect) return
  imagePointerAction = action
  imagePointerStart = { x: event.clientX, y: event.clientY, rect, initial: { ...backgroundImageRect.value } }
  event.currentTarget.setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', moveImageTransform)
  window.addEventListener('pointerup', endImageTransform, { once: true })
  window.addEventListener('pointercancel', endImageTransform, { once: true })
}
function moveImageTransform(event) {
  if (!imagePointerStart || !imagePointerAction) return
  const { rect, initial } = imagePointerStart
  const dx = (event.clientX - imagePointerStart.x) / rect.width * 100
  const dy = (event.clientY - imagePointerStart.y) / rect.height * 100
  if (imagePointerAction === 'move') {
    backgroundImageRect.value = { ...initial, x: initial.x + dx, y: initial.y + dy }
  } else {
    const next = { ...initial }
    if (imagePointerAction.includes('e')) next.width = Math.max(5, initial.width + dx)
    if (imagePointerAction.includes('s')) next.height = Math.max(5, initial.height + dy)
    if (imagePointerAction.includes('w')) { next.width = Math.max(5, initial.width - dx); next.x = initial.x + dx }
    if (imagePointerAction.includes('n')) { next.height = Math.max(5, initial.height - dy); next.y = initial.y + dy }
    backgroundImageRect.value = next
  }
}
function endImageTransform() {
  imagePointerAction = null
  imagePointerStart = null
  window.removeEventListener('pointermove', moveImageTransform)
}

defineExpose({ seek, zoomIn, zoomOut, resetView, setLayerVisible, setAllLayersVisible, saveScreenshot, exportAnimation })

onMounted(() => {
  document.addEventListener('pointerdown', handlePreviewPointerDown, true)
  hostEl.value?.addEventListener('pointerdown', onCharacterPointerDown, true)
  host = hostEl.value
  load()
  progressFrame = requestAnimationFrame(updateProgress)
})
watch(() => [props.files, props.assetBase], load)
onBeforeUnmount(() => {
  hostEl.value?.removeEventListener('pointerdown', onCharacterPointerDown, true)
  dropClickTracker()
  destroyVoiceBank()
  document.removeEventListener('pointerdown', handlePreviewPointerDown, true)
  window.removeEventListener('pointermove', moveImageTransform)
  window.removeEventListener('pointermove', moveColorPicker)
  window.removeEventListener('pointerup', stopColorPicker)
  window.removeEventListener('pointercancel', stopColorPicker)
  if (backgroundObjectUrl) URL.revokeObjectURL(backgroundObjectUrl)
  cancelAnimationFrame(progressFrame)
  loadToken++
  release()
})
</script>

<template>
  <div class="spine-preview">
    <div ref="backgroundLayerEl" class="preview-background" :style="{ backgroundColor }">
      <img v-if="backgroundImage" ref="backgroundImageElement" :src="backgroundImage" class="preview-background-image"
        :style="{ left: backgroundImageRect.x + '%', top: backgroundImageRect.y + '%', width: backgroundImageRect.width + '%', height: backgroundImageRect.height + '%' }"
        draggable="false" />
    </div>
    <div ref="hostEl" data-spine-preview-host class="spine-preview-host"></div>
    <div v-if="backgroundImage && backgroundImageEditMode" class="preview-image-controls">
      <div class="preview-image-outline" :style="{ left: backgroundImageRect.x + '%', top: backgroundImageRect.y + '%', width: backgroundImageRect.width + '%', height: backgroundImageRect.height + '%' }" @pointerdown="beginImageTransform($event, 'move')">
        <button v-for="handle in ['nw','ne','sw','se']" :key="handle" type="button" class="preview-image-handle" :class="handle" :aria-label="'Resize background image from ' + handle" @pointerdown.stop="beginImageTransform($event, handle)" />
      </div>
      <div class="preview-image-instructions">DRAG IMAGE TO MOVE · DRAG CORNER HANDLES TO STRETCH</div>
    </div>
    <div class="preview-background-tools">
      <button ref="colorPickerButtonEl" type="button" class="preview-tool-button" @click="colorPickerOpen = !colorPickerOpen">COLOR</button>
      <button type="button" class="preview-tool-button" @click="openImagePicker">UPLOAD IMAGE</button>
      <button v-if="backgroundImage" type="button" class="preview-tool-button" @click="backgroundImageEditMode = !backgroundImageEditMode">{{ backgroundImageEditMode ? 'DONE' : 'EDIT IMAGE' }}</button>
      <button v-if="backgroundImage" type="button" class="preview-tool-button" @click="clearBackgroundImage">REMOVE IMAGE</button>
      <input ref="imageFileInput" class="preview-file-input" type="file" accept="image/*" @change="loadBackgroundImage" />
    </div>
    <div v-if="colorPickerOpen" ref="colorPickerPopoverEl" class="preview-color-popover">
      <div class="preview-color-heading">BACKGROUND COLOR</div>
      <div ref="hueSquareEl" class="preview-color-square" role="application" aria-label="Saturation and brightness picker"
        :style="{ backgroundColor: 'hsl(' + pickerHue + ', 100%, 50%)' }" @pointerdown="startSquareAdjust">
        <span class="preview-color-square-white"></span>
        <span class="preview-color-square-black"></span>
        <span class="preview-color-square-cursor" :style="{ left: hsvColor().s + '%', top: (100 - hsvColor().v) + '%' }"></span>
      </div>
      <input class="preview-hue-slider" type="range" min="0" max="360" step="1" :value="Math.round(hsvColor().h)"
        aria-label="Hue" @input="setHueFromSlider($event.target.value)" />
      <div class="preview-color-modes">
        <button v-for="mode in ['RGB','HEX','HSL']" :key="mode" type="button" :class="{ selected: colorMode === mode }" @click="colorMode = mode">{{ mode }}</button>
      </div>
      <div v-if="colorMode === 'HEX'" class="preview-color-fields hex">
        <label>HEX <input :value="backgroundColor" maxlength="7" @change="updateHexColor($event.target.value)" /></label>
      </div>
      <div v-else-if="colorMode === 'RGB'" class="preview-color-fields">
        <label>R <input type="number" min="0" max="255" :value="rgbColor().r" @change="setRgbColor($event.target.value, rgbColor().g, rgbColor().b)" /></label>
        <label>G <input type="number" min="0" max="255" :value="rgbColor().g" @change="setRgbColor(rgbColor().r, $event.target.value, rgbColor().b)" /></label>
        <label>B <input type="number" min="0" max="255" :value="rgbColor().b" @change="setRgbColor(rgbColor().r, rgbColor().g, $event.target.value)" /></label>
      </div>
      <div v-else class="preview-color-fields">
        <label>H <input type="number" min="0" max="360" :value="hslColor().h" @change="setHslColor($event.target.value, hslColor().s, hslColor().l)" /></label>
        <label>S <input type="number" min="0" max="100" :value="hslColor().s" @change="setHslColor(hslColor().h, $event.target.value, hslColor().l)" /></label>
        <label>L <input type="number" min="0" max="100" :value="hslColor().l" @change="setHslColor(hslColor().h, hslColor().s, $event.target.value)" /></label>
      </div>
      <button type="button" class="preview-reset-color" @click="resetBackgroundColor">RESET DEFAULT COLOR</button>
    </div>
  </div>
</template>

<style>
.spine-preview {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  touch-action: none;
}
.spine-preview-host {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: center center;
}

.spine-preview-host canvas:active { cursor: grabbing; }
.spine-preview-host canvas {
  cursor: grab;
  touch-action: none;
  display: block;
  width: 100% !important;
  height: 100% !important;
  object-fit: contain;
}
.spine-preview-host .spine-player {
  width: 100%;
  height: 100%;
}
.import-error {
  color: #fca5a5;
  font-size: 11px;
  margin-top: 10px;
}
.spine-error {
  position: absolute;
  z-index: 5;
  left: 16px;
  right: 16px;
  bottom: 42px;
  padding: 10px 12px;
  border: 1px solid #7f3f4b;
  border-radius: 8px;
  background: #351d27ee;
  color: #ffc1cb;
  font-size: 11px;
}

.preview-background { position:absolute; inset:0; z-index:0; overflow:hidden; pointer-events:none; }
.preview-background-image { position:absolute; max-width:none; max-height:none; object-fit:fill; pointer-events:none; user-select:none; }
.preview-image-controls { position:absolute; inset:0; z-index:3; pointer-events:none; }
.preview-image-outline { position:absolute; border:1px dashed #fff; pointer-events:auto; cursor:move; touch-action:none; }
.preview-image-handle { position:absolute; width:18px; height:18px; padding:0; border:2px solid #fff; border-radius:50%; background:#9272c2; box-shadow:0 1px 5px #0009; touch-action:none; }
.preview-image-handle.nw { left:-9px; top:-9px; cursor:nwse-resize; }
.preview-image-handle.ne { right:-9px; top:-9px; cursor:nesw-resize; }
.preview-image-handle.sw { left:-9px; bottom:-9px; cursor:nesw-resize; }
.preview-image-handle.se { right:-9px; bottom:-9px; cursor:nwse-resize; }
.preview-image-instructions { position:absolute; z-index:3; left:50%; bottom:12px; transform:translateX(-50%); padding:7px 10px; border:1px solid #ffffff55; border-radius:5px; background:#17141dcc; color:#fff; font-size:10px; font-weight:700; letter-spacing:.35px; white-space:nowrap; pointer-events:none; }
.preview-background-tools { position:absolute; z-index:8; top:12px; right:12px; display:flex; gap:6px; align-items:center; }
.preview-tool-button { min-height:30px; padding:0 9px; border:1px solid #393642; border-radius:6px; background:#1b1922ef; color:#e5d9f5; font:700 9px 'DM Sans',sans-serif; letter-spacing:.45px; cursor:pointer; transition:background-color .16s ease,border-color .16s ease,color .16s ease; }
.preview-tool-button:hover { border-color:#b59ae8; background:#392d4d; color:#fff; }
.preview-tool-button:focus-visible { outline:2px solid #b99be8; outline-offset:2px; }
.preview-file-input { display:none; }
.preview-color-popover { position:absolute; z-index:12; top:49px; right:12px; width:280px; max-width:calc(100vw - 32px); padding:12px; border:1px solid #55466b; border-radius:10px; background:#1b1922f5; box-shadow:0 12px 35px #000a; color:#eee8f6; }
.preview-color-heading { margin-bottom:10px; font-size:9px; font-weight:700; letter-spacing:1px; color:#bfb0d2; }
.preview-color-square { position:relative; width:100%; height:190px; margin:0 0 14px; overflow:hidden; border-radius:7px; cursor:crosshair; touch-action:none; user-select:none; box-shadow:inset 0 0 0 1px #ffffff35; }
.preview-color-square-white,.preview-color-square-black { position:absolute; inset:0; pointer-events:none; }
.preview-color-square-white { background:linear-gradient(to right,#fff,transparent); }
.preview-color-square-black { background:linear-gradient(to top,#000,transparent); }
.preview-color-square-cursor { position:absolute; z-index:2; width:14px; height:14px; transform:translate(-50%,-50%); border:2px solid #fff; border-radius:50%; box-shadow:0 0 0 1px #111,0 1px 4px #0009; pointer-events:none; }
.preview-hue-slider { display:block; width:100%; height:16px; margin:0 0 14px; appearance:none; -webkit-appearance:none; border:0; border-radius:9px; background:linear-gradient(to right,#f00 0%,#ff0 16.66%,#0f0 33.33%,#0ff 50%,#00f 66.66%,#f0f 83.33%,#f00 100%); cursor:pointer; }
.preview-hue-slider::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; width:14px; height:22px; border:2px solid #fff; border-radius:4px; background:#27232f; box-shadow:0 1px 4px #000a; }
.preview-hue-slider::-moz-range-thumb { width:10px; height:18px; border:2px solid #fff; border-radius:4px; background:#27232f; box-shadow:0 1px 4px #000a; }
.preview-reset-color { width:100%; min-height:30px; margin-top:10px; border:1px solid #66547f; border-radius:5px; background:#292331; color:#e5d9f5; font-size:10px; font-weight:700; cursor:pointer; }
.preview-reset-color:hover { background:#392d4d; border-color:#b59ae8; }
.preview-color-modes { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; margin-bottom:9px; }
.preview-color-modes button { min-height:27px; border:1px solid #393342; border-radius:5px; background:#24212d; color:#aaa0b9; font-size:9px; font-weight:700; cursor:pointer; transition:background .15s ease,border-color .15s ease,color .15s ease,box-shadow .15s ease; }
.preview-color-modes button:hover { border-color:#9272c2; background:#332a40; color:#f4edff; }
.preview-color-modes button:focus-visible { outline:2px solid #b99be8; outline-offset:2px; }
.preview-color-modes button.selected { border-color:#a98bd8; background:#46365c; color:#fff; box-shadow:inset 0 0 0 1px #9272c255; }
.preview-color-fields input { appearance:textfield; -moz-appearance:textfield; transition:border-color .15s ease,background .15s ease,box-shadow .15s ease; }
.preview-color-fields input::-webkit-inner-spin-button,
.preview-color-fields input::-webkit-outer-spin-button { -webkit-appearance:none; appearance:none; margin:0; }
.preview-color-fields input:hover { border-color:#786292; background:#191620; }
.preview-color-fields input:focus { border-color:#a98bd8; background:#17141f; box-shadow:0 0 0 2px #9272c233; }
.preview-color-fields label { transition:color .15s ease; }
.preview-color-fields label:focus-within { color:#d9c8f2; }
.preview-color-fields { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
.preview-color-fields.hex { grid-template-columns:1fr; }
.preview-color-fields label { display:grid; gap:4px; color:#a99eb7; font-size:9px; }
.preview-color-fields input { width:100%; min-width:0; height:30px; box-sizing:border-box; padding:0 6px; border:1px solid #40394b; border-radius:5px; outline:0; background:#111016; color:#f5efff; font:11px 'DM Mono',monospace; }
.preview-color-fields input:focus { border-color:#9272c2; }
.spine-preview-host { z-index:1; }
.spine-preview-host .spine-player { background:transparent !important; }
.spine-preview-host canvas { background:transparent !important; }

</style>
