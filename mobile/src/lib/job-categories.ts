/** Split DB category field ("a, b") into individual repair category keys. */
export function parseJobCategories(
  category?: string | null,
  categories?: string[] | null
): string[] {
  if (Array.isArray(categories) && categories.length > 0) {
    return categories.map((c) => c.trim()).filter(Boolean);
  }
  if (!category?.trim()) return [];
  return category.split(',').map((c) => c.trim()).filter(Boolean);
}