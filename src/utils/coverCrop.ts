export interface CropState {
  imageWidth: number; imageHeight: number; frameWidth: number; frameHeight: number
  scale: number; x: number; y: number
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
export const minimumScale = (state: CropState) => Math.max(state.frameWidth / state.imageWidth, state.frameHeight / state.imageHeight)
export function panCrop(state: CropState, dx: number, dy: number): CropState {
  return { ...state, x: clamp(state.x + dx, state.frameWidth - state.imageWidth * state.scale, 0), y: clamp(state.y + dy, state.frameHeight - state.imageHeight * state.scale, 0) }
}
export function createCrop(imageWidth: number, imageHeight: number, frameWidth: number): CropState {
  if (![imageWidth, imageHeight, frameWidth].every(value => Number.isFinite(value) && value > 0)) throw new Error('照片尺寸无效')
  const state = { imageWidth, imageHeight, frameWidth, frameHeight: frameWidth / 1.25, scale: 1, x: 0, y: 0 }
  state.scale = minimumScale(state)
  state.x = (state.frameWidth - imageWidth * state.scale) / 2
  state.y = (state.frameHeight - imageHeight * state.scale) / 2
  // Portraits usually put the head in the upper third; start there while still
  // allowing the user to choose any crop. Already-5:4 photos remain unchanged.
  if (imageHeight > imageWidth) state.y = state.frameHeight / 2 - imageHeight * state.scale / 3
  return panCrop(state, 0, 0)
}
export function zoomCrop(state: CropState, scale: number): CropState {
  const next = clamp(scale, minimumScale(state), minimumScale(state) * 3)
  const ratio = next / state.scale
  return panCrop({ ...state, scale: next, x: state.frameWidth / 2 - (state.frameWidth / 2 - state.x) * ratio, y: state.frameHeight / 2 - (state.frameHeight / 2 - state.y) * ratio }, 0, 0)
}
export function cropRectangle(state: CropState) {
  return {
    x: Math.max(0, -state.x / state.scale / state.imageWidth),
    y: Math.max(0, -state.y / state.scale / state.imageHeight),
    width: Math.min(1, state.frameWidth / state.scale / state.imageWidth),
    height: Math.min(1, state.frameHeight / state.scale / state.imageHeight),
  }
}
