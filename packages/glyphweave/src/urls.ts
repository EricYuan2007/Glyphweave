/** Recognizable filesystem paths must never become public resource URLs. */
export function isLocalAbsoluteUrl(value: string) {
  return /^(?:\/(?:Users|home|private|tmp|etc|var)\/|~\/|file:|[A-Za-z]:[\\/])/i.test(value.trim())
}
