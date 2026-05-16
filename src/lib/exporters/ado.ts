/**
 * Export a story map as a CSV compatible with Azure DevOps' CSV import.
 *
 * Mapping:
 *   Feature  -> Epic
 *   Epic     -> Feature (ADO's hierarchy: Epic > Feature > User Story)
 *   Story    -> User Story
 *   Release  -> Iteration Path
 *
 * ADO's CSV import expects:
 *   Work Item Type, Title 1, Title 2, Title 3, Description,
 *   Acceptance Criteria, Iteration Path, Tags
 *
 * The Title columns create a hierarchy: Title 1 is the top-level parent,
 * Title 2 is nested under it, Title 3 is nested under Title 2.
 */

import type { StoryMap } from '../../types'
import { buildCsv, downloadFile } from './csv'

const HEADERS = [
  'Work Item Type',
  'Title 1',
  'Title 2',
  'Title 3',
  'Description',
  'Acceptance Criteria',
  'Iteration Path',
  'Tags',
]

export function exportToADO(map: StoryMap) {
  const releaseMap = new Map(map.releases.map((r) => [r.id, r.name]))
  const rows: string[][] = []

  for (const feature of map.features) {
    // Feature -> Epic (Title 1)
    rows.push([
      'Epic',
      feature.title,
      '',
      '',
      feature.description,
      feature.acceptance_criteria,
      '',
      '',
    ])

    for (const epic of feature.epics) {
      // Epic -> Feature (Title 2, nested under parent Epic)
      rows.push([
        'Feature',
        feature.title,
        epic.title,
        '',
        epic.description,
        epic.acceptance_criteria,
        '',
        '',
      ])

      for (const story of epic.stories) {
        // Story -> User Story (Title 3, nested under parent Feature)
        const iterationPath = story.release_id ? releaseMap.get(story.release_id) || '' : ''
        rows.push([
          'User Story',
          feature.title,
          epic.title,
          story.title,
          story.description,
          story.acceptance_criteria,
          iterationPath,
          '',
        ])
      }
    }
  }

  const csv = buildCsv(HEADERS, rows)
  const filename = `${map.name.replace(/\s+/g, '_').toLowerCase()}_ado.csv`
  downloadFile(csv, filename)
}
