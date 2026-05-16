/**
 * Export a story map as a CSV compatible with Jira's CSV import.
 *
 * Mapping:
 *   Feature  -> Epic
 *   Epic     -> Story (with Epic Link set to the parent feature title)
 *   Story    -> Sub-task (with Epic Link and parent story reference)
 *   Release  -> Fix Version
 *
 * Jira's CSV importer expects headers like:
 *   Summary, Issue Type, Description, Epic Link, Fix Version, Acceptance Criteria
 */

import type { StoryMap } from '../../types'
import { buildCsv, downloadFile } from './csv'

const HEADERS = [
  'Summary',
  'Issue Type',
  'Description',
  'Acceptance Criteria',
  'Epic Link',
  'Fix Version',
]

export function exportToJira(map: StoryMap) {
  const releaseMap = new Map(map.releases.map((r) => [r.id, r.name]))
  const rows: string[][] = []

  for (const feature of map.features) {
    // Feature -> Epic
    rows.push([
      feature.title,
      'Epic',
      feature.description,
      feature.acceptance_criteria,
      '', // no parent epic
      '',
    ])

    for (const epic of feature.epics) {
      // Epic -> Story
      rows.push([
        epic.title,
        'Story',
        epic.description,
        epic.acceptance_criteria,
        feature.title, // Epic Link
        '',
      ])

      for (const story of epic.stories) {
        // Story -> Sub-task
        const fixVersion = story.release_id ? releaseMap.get(story.release_id) || '' : ''
        rows.push([
          story.title,
          'Sub-task',
          story.description,
          story.acceptance_criteria,
          feature.title,
          fixVersion,
        ])
      }
    }
  }

  const csv = buildCsv(HEADERS, rows)
  const filename = `${map.name.replace(/\s+/g, '_').toLowerCase()}_jira.csv`
  downloadFile(csv, filename)
}
