/**
 * Cards spread into balanced columns with no empty holes: the container
 * measures itself, picks how many columns fit, and drops each card into
 * the currently shortest column (by an estimated content weight). Columns
 * pack independently, so unequal card heights never leave gaps — and on a
 * phone everything degrades to one column in the given order.
 */
import { useState, type ReactNode } from "react";
import { View } from "react-native";

export type SpreadCard = {
  key: string;
  /** Rough content size (item count works well) used to balance columns. */
  weight: number;
  node: ReactNode;
};

export function SpreadColumns({
  cards,
  minColumnWidth = 300,
  maxColumns = 3,
  gap = 12,
}: {
  cards: SpreadCard[];
  minColumnWidth?: number;
  maxColumns?: number;
  gap?: number;
}) {
  const [width, setWidth] = useState(0);

  const fit = Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)));
  const count = Math.min(maxColumns, fit, cards.length);

  const columns: SpreadCard[][] = Array.from({ length: count }, () => []);
  const heights = new Array<number>(count).fill(0);
  for (const card of cards) {
    let shortest = 0;
    for (let i = 1; i < count; i++) if (heights[i] < heights[shortest]) shortest = i;
    columns[shortest].push(card);
    heights[shortest] += card.weight;
  }

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: "row", gap, alignItems: "flex-start" }}
    >
      {width > 0 &&
        columns.map((column, i) => (
          <View key={i} style={{ flex: 1, minWidth: 0, gap }}>
            {column.map((card) => (
              <View key={card.key}>{card.node}</View>
            ))}
          </View>
        ))}
    </View>
  );
}
