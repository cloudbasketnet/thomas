// Helpers for the Photo Security Lock scene: finding people in the photo, and
// cutting a head-shot out of it for the setup list.
//
// Automatic detection uses the browser's own FaceDetector, which only some
// browsers ship (Chrome on Android, and desktop Chrome behind a flag). There is
// no model download and nothing is uploaded anywhere — when the browser cannot
// do it, the user marks each person by dragging a box on the photo instead, and
// the result is identical either way.
import type { SceneFace } from '@/types'
import { uid } from '@/lib/format'

/** A box in 0–1 coordinates relative to the photo, so it survives any display size. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export const faceDetectionSupported = () => typeof (globalThis as any).FaceDetector === 'function'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = src
  })
}

/** Clamp a box inside the photo and keep it big enough to tap (2% of the photo). */
export function clampBox(b: Box): Box {
  const w = Math.min(1, Math.max(0.02, b.w))
  const h = Math.min(1, Math.max(0.02, b.h))
  return {
    w,
    h,
    x: Math.min(1 - w, Math.max(0, b.x)),
    y: Math.min(1 - h, Math.max(0, b.y)),
  }
}

/**
 * Ask the browser to find the faces. Returns an empty list — never throws —
 * when the browser has no FaceDetector or finds nobody, so the caller can fall
 * back to manual marking without special-casing.
 */
export async function detectFaces(img: HTMLImageElement, max = 40): Promise<Box[]> {
  const Detector = (globalThis as any).FaceDetector
  if (typeof Detector !== 'function') return []
  try {
    const detector = new Detector({ fastMode: true, maxDetectedFaces: max })
    const found: { boundingBox: { x: number; y: number; width: number; height: number } }[] = await detector.detect(img)
    const W = img.naturalWidth || img.width
    const H = img.naturalHeight || img.height
    if (!W || !H) return []
    return found
      .map((f) =>
        clampBox({
          // Widen a little: FaceDetector returns the face itself, and a head
          // with some shoulder is far easier to recognise and to tap.
          x: (f.boundingBox.x - f.boundingBox.width * 0.15) / W,
          y: (f.boundingBox.y - f.boundingBox.height * 0.2) / H,
          w: (f.boundingBox.width * 1.3) / W,
          h: (f.boundingBox.height * 1.4) / H,
        }),
      )
      .sort((a, b) => a.x - b.x)
  } catch {
    return []
  }
}

/** Cut `box` out of the photo as a small square JPEG, for the "Person 01" rows. */
export function cropFace(img: HTMLImageElement, box: Box, size = 96): string | undefined {
  const W = img.naturalWidth || img.width
  const H = img.naturalHeight || img.height
  if (!W || !H) return undefined
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  // Square off the crop around the box's centre so faces are not stretched.
  const side = Math.max(box.w * W, box.h * H)
  const cx = (box.x + box.w / 2) * W
  const cy = (box.y + box.h / 2) * H
  ctx.drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size)
  try {
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch {
    return undefined // a cross-origin photo taints the canvas; the box still works
  }
}

/** Turn detected or drawn boxes into scene people, keeping the left-to-right order stable. */
export function toFaces(img: HTMLImageElement, boxes: Box[]): SceneFace[] {
  return boxes.map((b) => ({
    id: uid('face'),
    ...clampBox(b),
    thumb: cropFace(img, b),
    question: '',
    enabled: true,
  }))
}
