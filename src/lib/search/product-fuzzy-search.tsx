import Fuse, { type FuseResult, type FuseResultMatch, type IFuseOptions } from "fuse.js";
import type { ReactNode } from "react";
import type { ProductRecord } from "@/lib/offline/db";

type SearchableProduct = {
  product: ProductRecord;
  nama_produk: string;
  sku: string;
  nama_compact: string;
  nama_word_bag: string;
  sku_compact: string;
};

export type ProductSearchMatchKey = "nama_produk" | "sku";

export type ProductSearchMatch = {
  key: ProductSearchMatchKey;
  indices: Array<[number, number]>;
};

export type ProductSearchResult = {
  product: ProductRecord;
  score: number;
  matches: ProductSearchMatch[];
};

type QueryVariant = {
  penalty: number;
  value: string;
};

const FUSE_OPTIONS = {
  distance: 300,
  findAllMatches: true,
  ignoreLocation: true,
  includeMatches: true,
  includeScore: true,
  keys: [
    { name: "nama_produk", weight: 0.72 },
    { name: "sku", weight: 0.14 },
    { name: "nama_compact", weight: 0.08 },
    { name: "nama_word_bag", weight: 0.04 },
    { name: "sku_compact", weight: 0.02 },
  ],
  minMatchCharLength: 1,
  shouldSort: true,
  useExtendedSearch: true,
  threshold: 0.4,
} satisfies IFuseOptions<SearchableProduct>;

function normalizeSearchText(value: string | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function compactSearchText(value: string | undefined) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function buildWordBag(value: string | undefined) {
  return normalizeSearchText(value)
    .split(/\s+/)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .join(" ");
}

function createSearchableProducts(products: ProductRecord[]) {
  return products.map((product) => ({
    product,
    nama_produk: product.nama_produk,
    sku: product.sku ?? "",
    nama_compact: compactSearchText(product.nama_produk),
    nama_word_bag: buildWordBag(product.nama_produk),
    sku_compact: compactSearchText(product.sku),
  }));
}

function createQueryVariants(query: string) {
  const normalized = normalizeSearchText(query);
  const compact = compactSearchText(query);
  const wordBag = buildWordBag(query);
  const variants: QueryVariant[] = [];
  const seen = new Set<string>();

  const pushVariant = (value: string, penalty: number) => {
    const normalizedValue = value.trim();
    if (!normalizedValue || seen.has(normalizedValue)) return;
    seen.add(normalizedValue);
    variants.push({ value: normalizedValue, penalty });
  };

  pushVariant(query.trim(), 0);
  pushVariant(normalized, 0.01);
  pushVariant(compact, 0.02);
  if (wordBag !== normalized) {
    pushVariant(wordBag, 0.03);
  }

  return variants;
}

function normalizeMatchKey(key: string | number | symbol | undefined): ProductSearchMatchKey | null {
  if (key === "nama_produk" || key === "sku") {
    return key;
  }
  return null;
}

function extractMatches(matches: readonly FuseResultMatch[] | undefined) {
  if (!matches) return [] as ProductSearchMatch[];
  return matches
    .map((match) => {
      const key = normalizeMatchKey(match.key);
      if (!key) return null;
      return {
        key,
        indices: match.indices.map(([start, end]) => [start, end] as [number, number]),
      };
    })
    .filter((match): match is ProductSearchMatch => match !== null);
}

function mergeMatchIndices(indices: Array<[number, number]>) {
  if (indices.length === 0) return [] as Array<[number, number]>;
  const sorted = [...indices].sort((left, right) => left[0] - right[0]);
  const merged: Array<[number, number]> = [sorted[0]];

  for (const [start, end] of sorted.slice(1)) {
    const current = merged[merged.length - 1];
    if (start <= current[1] + 1) {
      current[1] = Math.max(current[1], end);
      continue;
    }
    merged.push([start, end]);
  }

  return merged;
}

function mergeMatches(existing: ProductSearchMatch[], incoming: ProductSearchMatch[]) {
  const grouped = new Map<ProductSearchMatchKey, Array<[number, number]>>();

  for (const match of [...existing, ...incoming]) {
    const current = grouped.get(match.key) ?? [];
    current.push(...match.indices);
    grouped.set(match.key, current);
  }

  return Array.from(grouped.entries()).map(([key, indices]) => ({
    key,
    indices: mergeMatchIndices(indices),
  }));
}

function toSearchResult(
  hit: FuseResult<SearchableProduct>,
  penalty: number,
): ProductSearchResult {
  return {
    product: hit.item.product,
    score: (hit.score ?? 0) + penalty,
    matches: extractMatches(hit.matches),
  };
}

function compareResults(left: ProductSearchResult, right: ProductSearchResult) {
  if (left.score !== right.score) {
    return left.score - right.score;
  }
  const nameCompare = left.product.nama_produk.localeCompare(right.product.nama_produk, "id-ID");
  if (nameCompare !== 0) {
    return nameCompare;
  }
  return left.product.id_produk.localeCompare(right.product.id_produk, "id-ID");
}

export function createProductSearch(products: ProductRecord[]) {
  const items = createSearchableProducts(products);
  const index = Fuse.createIndex(FUSE_OPTIONS.keys ?? [], items);
  const fuse = new Fuse(items, FUSE_OPTIONS, index);
  const allProducts = products.map((product) => ({
    product,
    score: 0,
    matches: [],
  })) satisfies ProductSearchResult[];

  return (query: string) => {
    if (!query.trim()) {
      return allProducts;
    }

    const mergedResults = new Map<string, ProductSearchResult>();

    for (const variant of createQueryVariants(query)) {
      const hits = fuse.search(variant.value);
      for (const hit of hits) {
        const candidate = toSearchResult(hit, variant.penalty);
        const existing = mergedResults.get(candidate.product.id_produk);
        if (!existing) {
          mergedResults.set(candidate.product.id_produk, candidate);
          continue;
        }

        const merged = {
          product: candidate.product,
          score: Math.min(existing.score, candidate.score),
          matches: mergeMatches(existing.matches, candidate.matches),
        } satisfies ProductSearchResult;

        mergedResults.set(candidate.product.id_produk, merged);
      }
    }

    return Array.from(mergedResults.values()).sort(compareResults);
  };
}

export function getProductMatchIndices(
  matches: ProductSearchMatch[],
  key: ProductSearchMatchKey,
) {
  return mergeMatchIndices(
    matches.filter((match) => match.key === key).flatMap((match) => match.indices),
  );
}

export function highlightMatchedText(text: string, indices: Array<[number, number]>): ReactNode {
  if (indices.length === 0) return text;

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const [start, end] of mergeMatchIndices(indices)) {
    if (start > cursor) {
      parts.push(text.slice(cursor, start));
    }
    parts.push(
      <strong className="font-black text-foreground" key={`${start}-${end}`}>
        {text.slice(start, end + 1)}
      </strong>,
    );
    cursor = end + 1;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
}
