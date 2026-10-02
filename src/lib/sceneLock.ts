// Pure rules for the Photo Security Lock — which people can be asked about, and
// which question comes next. Type imports only, so it is unit-tested in plain
// Node; everything that touches the database lives in src/lib/security.ts.
import type { SceneFace, SecurityScene } from '@/types'

/** Faces that can actually be asked about: marked, switched on and given a question. */
export function askableFaces(scene: SecurityScene | undefined): SceneFace[] {
  if (!scene) return []
  return scene.faces.filter((f) => f.enabled && (f.question ?? '').trim().length > 0)
}

/** A scene can lock the app once it has a question and at least two people to choose between. */
export function sceneUsable(scene: SecurityScene | undefined): boolean {
  return askableFaces(scene).length > 0 && (scene?.faces.length ?? 0) >= 2
}

/**
 * The next question to ask. `avoid` is the one shown last on this device (or
 * the one the user rejected with "Try another way"); it is skipped only while
 * something else is left to ask.
 */
export function pickFace(
  askable: SceneFace[],
  scene: Pick<SecurityScene, 'randomQuestion'>,
  avoid: string | undefined,
  random: () => number = Math.random,
): SceneFace | undefined {
  if (!askable.length) return undefined
  let pool = askable
  if (avoid) {
    const narrowed = askable.filter((f) => f.id !== avoid)
    if (narrowed.length) pool = narrowed
  }
  if (scene.randomQuestion === false) return pool[0]
  return pool[Math.floor(random() * pool.length)]
}
