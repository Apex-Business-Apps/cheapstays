import React, { useState } from "react";
import type { Product } from "../../shared/types";

let pickerCounter = 0;

/**
 * A searchable product picker built on a native <input list> + <datalist> —
 * no extra dependency, works fully offline, and lets the user type to filter
 * instead of hand-typing the product name every time (spec §3).
 */
export function ProductPicker({
  products,
  value,
  onChange,
  placeholder = "Търсете продукт…",
}: {
  products: Product[];
  value: number | null;
  onChange: (productId: number | null) => void;
  placeholder?: string;
}) {
  const [listId] = useState(() => `product-list-${++pickerCounter}`);
  const selected = products.find((p) => p.id === value) ?? null;
  const [text, setText] = useState(selected?.name ?? "");

  function handleChange(newText: string) {
    setText(newText);
    const match = products.find((p) => p.name.toLowerCase() === newText.trim().toLowerCase());
    onChange(match ? match.id : null);
  }

  React.useEffect(() => {
    setText(selected?.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <>
      <input
        type="text"
        list={listId}
        value={text}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
      />
      <datalist id={listId}>
        {products.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
    </>
  );
}
