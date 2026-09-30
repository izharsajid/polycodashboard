import { CATEGORIES, type Category } from '../../engine/classify'
import { previousStatement, type Model } from '../../engine/funds'

/**
 * The one selection model on the page. Selecting a statement anywhere, in the
 * chart, the coverage rail, the register or the statement's own arrows, goes
 * through here, and every section reads from here.
 */
export type Selection = {
  selectedId: string
  compareId: string
  /** Once the reader picks a comparison it stays put; until then it follows the selection. */
  compareChosen: boolean
  active: ReadonlySet<Category>
}

export type SelectionAction =
  | { type: 'select'; id: string }
  | { type: 'compare'; id: string }
  | { type: 'toggle'; category: Category }
  | { type: 'showAll' }

export function initialSelection(model: Model): Selection {
  const latest = model.requests[model.requests.length - 1]
  return {
    selectedId: latest.id,
    compareId: defaultCompare(model, latest.id),
    compareChosen: false,
    active: new Set(CATEGORIES),
  }
}

function defaultCompare(model: Model, id: string): string {
  const before = previousStatement(model, id)
  if (before) return before.id
  return model.statements.find((s) => s.id !== id)?.id ?? id
}

export function selectionReducer(model: Model) {
  return (state: Selection, action: SelectionAction): Selection => {
    switch (action.type) {
      case 'select': {
        const keep = state.compareChosen && state.compareId !== action.id
        return {
          ...state,
          selectedId: action.id,
          compareId: keep ? state.compareId : defaultCompare(model, action.id),
          compareChosen: keep,
        }
      }
      case 'compare':
        return { ...state, compareId: action.id, compareChosen: true }
      case 'toggle': {
        const next = new Set(state.active)
        if (next.has(action.category)) {
          // The last category stays on: an empty chart answers nothing.
          if (next.size === 1) return state
          next.delete(action.category)
        } else {
          next.add(action.category)
        }
        return { ...state, active: next }
      }
      case 'showAll':
        return { ...state, active: new Set(CATEGORIES) }
    }
  }
}
