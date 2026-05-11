import { apiBaseUrl, apiFetch, authHeaders } from "./authApi";
import { ExpenseCategory } from "./types";

export type ProductCandidate = {
  id: string;
  barcode: string;
  title: string;
  brand?: string;
  spec?: string;
  category: ExpenseCategory;
  imageUrl?: string;
  source: string;
  confidence?: number;
  url?: string;
};

export type ProductLookupResponse = {
  barcode: string;
  fromCache: boolean;
  candidates: ProductCandidate[];
  message: string;
};

async function parseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { code?: string; message?: string };
    return `${body.code ? `${body.code}: ` : ""}${body.message || fallback}`;
  } catch {
    return fallback;
  }
}

export async function lookupBarcodeProduct(barcode: string): Promise<ProductLookupResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/products/barcode/${encodeURIComponent(barcode)}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `查询商品失败（${response.status}）`));
  return (await response.json()) as ProductLookupResponse;
}
