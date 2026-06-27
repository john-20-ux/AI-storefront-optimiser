import type { GraphqlClient } from "./fetchProducts";
import { applyProductUpdate, applyImageAlt, type ProductUpdateFields } from "./mutations";

// A set of approved field values to write to one product. Any subset may be present.
export interface FieldSelection {
  title?: string;
  descriptionHtml?: string;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string; // comma-separated; converted to string[]
  imageAlt?: string;
}

export interface ApplyResult {
  appliedFields: string[];
  errors: string[];
}

/**
 * Apply a set of approved field changes to a single product.
 * `firstImageMediaId` is required only when `imageAlt` is included.
 */
export async function applySelectedFixes(
  admin: GraphqlClient,
  gid: string,
  selection: FieldSelection,
  firstImageMediaId?: string | null,
): Promise<ApplyResult> {
  const errors: string[] = [];
  const appliedFields: string[] = [];

  const fields: ProductUpdateFields = {};
  if (selection.title !== undefined) fields.title = selection.title;
  if (selection.descriptionHtml !== undefined) fields.descriptionHtml = selection.descriptionHtml;
  if (selection.seoTitle !== undefined) fields.seoTitle = selection.seoTitle;
  if (selection.seoDescription !== undefined) fields.seoDescription = selection.seoDescription;
  if (selection.tags !== undefined) {
    fields.tags = selection.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  if (Object.keys(fields).length > 0) {
    const errs = await applyProductUpdate(admin, gid, fields);
    if (errs.length) errors.push(...errs);
    else appliedFields.push(...Object.keys(fields));
  }

  if (selection.imageAlt !== undefined) {
    if (firstImageMediaId) {
      const errs = await applyImageAlt(admin, firstImageMediaId, selection.imageAlt);
      if (errs.length) errors.push(...errs);
      else appliedFields.push("imageAlt");
    } else {
      errors.push("No image found to update alt text.");
    }
  }

  return { appliedFields, errors };
}
