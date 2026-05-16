/**
 * Filenames for maps stored on disk (FSA mode).
 *
 * Human-readable so the folder is browsable / backup-friendly, but
 * suffixed with a short id slice so two maps with the same name never
 * collide and a rename can find-and-replace the old file.
 */

export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD') // decompose accents: é -> e + combining mark
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // any run of non-alphanumerics -> one '-'
    .replace(/^-+|-+$/g, '') // trim leading/trailing '-'
  return slug || 'map'
}

export function fileNameFor(map: { id: string; name: string }): string {
  return `${slugify(map.name)}--${map.id.slice(0, 6)}.json`
}
