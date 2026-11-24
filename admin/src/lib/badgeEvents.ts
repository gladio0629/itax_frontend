/** Ask the layout to reload the sidebar counters (getSectionBadges) after an
 * action that changes them, e.g. a decided manager request. */
const EVENT = "izgo:section-badges";
export const refreshSectionBadges = () => window.dispatchEvent(new Event(EVENT));
export function onSectionBadgesRefresh(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
