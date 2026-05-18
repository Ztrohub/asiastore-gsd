"use client";

import { useMemo, useState } from "react";
import { formatCurrencyIdr } from "@/features/format/currency";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function parseRawPrice(raw: string) {
  const cleaned = digitsOnly(raw);
  if (!cleaned) return 0;
  return Number(cleaned);
}

export function useProductPriceInput(initialValue = 0) {
  const [rawValue, setRawValue] = useState(initialValue > 0 ? String(initialValue) : "");
  const [displayValue, setDisplayValue] = useState(
    initialValue > 0 ? formatCurrencyIdr(initialValue) : "",
  );
  const [hasDecimalFraction, setHasDecimalFraction] = useState(false);

  const numericValue = useMemo(() => parseRawPrice(rawValue), [rawValue]);

  function onChange(nextValue: string) {
    setHasDecimalFraction(/[.,]\d{1,2}$/.test(nextValue.trim()));
    setRawValue(digitsOnly(nextValue));
    setDisplayValue(nextValue);
  }

  function onBlur() {
    if (!rawValue) {
      setDisplayValue("");
      return;
    }
    setDisplayValue(formatCurrencyIdr(numericValue));
  }

  function reset() {
    setRawValue("");
    setDisplayValue("");
    setHasDecimalFraction(false);
  }

  function setNumeric(nextValue: number) {
    const safe = Number.isFinite(nextValue) ? Math.max(0, Math.trunc(nextValue)) : 0;
    if (safe <= 0) {
      reset();
      return;
    }
    setRawValue(String(safe));
    setDisplayValue(formatCurrencyIdr(safe));
    setHasDecimalFraction(false);
  }

  return { rawValue, displayValue, numericValue, hasDecimalFraction, onChange, onBlur, reset, setNumeric };
}
