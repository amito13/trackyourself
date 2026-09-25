import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, ui } from '@/constants/theme';
import { formatNumber, shortDate, type ChartPoint } from './model';

const BLUE = '#32A9E0';
const HEIGHT = 156;
const INSET = 12;

export function TrendChart({ points, kind }: { points: ChartPoint[]; kind: 'bar' | 'line' }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const maximum = Math.max(1, ...points.map((p) => p.value));
  const top = Math.ceil(maximum / 4) * 4;
  const plotWidth = Math.max(0, width - INSET * 2);
  // UTC calendar-day distances avoid DST affecting the spacing of dates.
  const firstDay = Date.parse(points[0]?.date ?? '1970-01-01');
  const lastDay = Date.parse(points[points.length - 1]?.date ?? '1970-01-01');
  const x = (i: number) => kind === 'bar'
    ? INSET + plotWidth * (i + 0.5) / points.length
    : INSET + (lastDay === firstDay ? plotWidth / 2 : plotWidth * (Date.parse(points[i].date) - firstDay) / (lastDay - firstDay));
  const y = (value: number) => INSET + HEIGHT * (1 - value / top);
  const active = selected === null ? undefined : points[selected];
  const dateLabel = (p: ChartPoint) => p.endDate && p.endDate !== p.date
    ? `${shortDate(p.date)} – ${shortDate(p.endDate)}` : shortDate(p.date);
  const compact = (n: number) => n >= 1000 ? `${formatNumber(n / 1000)}k` : formatNumber(n);
  return (
    <View style={ui.smallStack}>
      <Text style={[ui.small, { minHeight: 36 }]} accessibilityLiveRegion="polite">
        {active ? `${dateLabel(active)} · ${formatNumber(active.value)} kg` : 'Tap a bar or point to see its value · kg'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ justifyContent: 'space-between', paddingVertical: INSET, height: HEIGHT + INSET * 2, minWidth: 34 }}>
          {[top, top / 2, 0].map((n) => <Text key={n} style={ui.small}>{compact(n)}</Text>)}
        </View>
        <View style={ui.flex}>
          <View style={{ height: HEIGHT + INSET * 2 }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
            {[0, 0.5, 1].map((n) => (
              <View key={n} style={[styles.grid, { top: INSET + HEIGHT * n }]} />
            ))}
            {width > 0 && kind === 'line' && points.slice(1).map((point, i) => {
              const dx = x(i + 1) - x(i);
              const dy = y(point.value) - y(points[i].value);
              const length = Math.hypot(dx, dy);
              return <View key={`line-${point.date}`} pointerEvents="none" style={{
                position: 'absolute', height: 2, width: length, backgroundColor: BLUE,
                left: (x(i) + x(i + 1) - length) / 2,
                top: (y(points[i].value) + y(point.value)) / 2 - 1,
                transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
              }} />;
            })}
            {width > 0 && points.map((point, i) => (
              <Pressable
                key={point.date}
                accessibilityRole="button"
                accessibilityLabel={`${dateLabel(point)}, ${formatNumber(point.value)} kilograms`}
                accessibilityState={{ selected: selected === i }}
                onPress={() => setSelected(i)}
                style={kind === 'bar' ? {
                  position: 'absolute', top: INSET, height: HEIGHT, left: x(i) - plotWidth / points.length / 2,
                  width: plotWidth / points.length, justifyContent: 'flex-end', paddingHorizontal: 2,
                } : { position: 'absolute', left: x(i) - 14, top: y(point.value) - 22, width: 28, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={kind === 'bar' ? {
                  height: point.value === 0 ? 2 : Math.max(2, HEIGHT * point.value / top),
                  borderTopLeftRadius: 4, borderTopRightRadius: 4,
                  backgroundColor: selected === i ? colors.text : point.value === 0 ? colors.border : BLUE,
                } : { width: selected === i ? 12 : 8, height: selected === i ? 12 : 8, borderRadius: 6, backgroundColor: selected === i ? colors.text : BLUE }} />
              </Pressable>
            ))}
          </View>
          <View style={[ui.between, { marginTop: 8 }]}>
            <Text style={ui.small}>{points[0] ? shortDate(points[0].date) : ''}</Text>
            {points.length > 1 && <Text style={ui.small}>{shortDate(points[points.length - 1].endDate ?? points[points.length - 1].date)}</Text>}
          </View>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border },
});
