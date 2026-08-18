/**
 * Buy Plan's Category level uses "(Uncategorized)" as the display label for
 * items with no product_category on record (inventory_snapshots has no
 * category field of its own, so this only happens for items never sold at
 * a given store). Route segments use the friendlier "uncategorized" slug
 * instead, mapping back to "" for the DB query.
 */
export function categoryToSlug(category: string): string {
  return category === "(Uncategorized)" ? "uncategorized" : encodeURIComponent(category);
}

export function slugToCategory(slug: string): string {
  return slug === "uncategorized" ? "" : decodeURIComponent(slug);
}
