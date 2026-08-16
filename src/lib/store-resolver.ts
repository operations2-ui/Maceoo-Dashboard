export interface StoreRef {
  id: string;
  name: string;
  code: string | null;
}

export interface StoreAlias {
  store_id: string;
  source: "inventory" | "sheet" | "vendor";
  alias_name: string;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+store$/i, "");

/**
 * Resolves a free-text name (a Drive folder name, or a "Location Name" cell from
 * the Discounts/Sales sheets) to a store id.
 *
 * Alias lookups (admin-curated, exact match) take priority over the fuzzy
 * name/code match, since inventory folder names and sheet location names are
 * not guaranteed to resemble the canonical store name at all (e.g. "CEOO DUBAI").
 */
export function resolveStoreId(
  name: string,
  stores: StoreRef[],
  aliases: StoreAlias[] = [],
  source?: "inventory" | "sheet" | "vendor",
): string | null {
  const trimmed = name.trim().toLowerCase();

  if (source) {
    const byAlias = aliases.find(
      (a) => a.source === source && a.alias_name.trim().toLowerCase() === trimmed,
    );
    if (byAlias) return byAlias.store_id;
  }

  const target = normalize(name);
  const byName = stores.find((s) => normalize(s.name) === target);
  if (byName) return byName.id;
  const byCode = stores.find((s) => s.code && s.code.trim().toLowerCase() === trimmed);
  if (byCode) return byCode.id;
  return null;
}
