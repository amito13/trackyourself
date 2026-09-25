import { Pressable, Text, View } from 'react-native';
import { Card, Icon, Section } from '@/components/ui';
import { palettes } from '@/constants/palettes';
import { useTheme } from '@/constants/theme';
import { useAppearance } from '@/state/appearance-store';

export function AppearanceSetting() {
  const { colors, ui } = useTheme();
  const { mode, setMode, error } = useAppearance();
  return (
    <View style={ui.stack}>
      <Section title="Appearance" trailing={<Icon name="sun" color={colors.accent} />} />
      <Card>
        <View style={ui.smallStack}>
          <Text style={ui.heading}>Your app. Your atmosphere.</Text>
          <Text style={ui.muted}>Choose the look that feels right.</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} accessibilityRole="radiogroup">
          {(['light', 'dark'] as const).map((option) => {
            const preview = palettes[option];
            const selected = mode === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={`${option === 'light' ? 'Light' : 'Dark'} mode`}
                accessibilityState={{ checked: selected }}
                onPress={() => setMode(option)}
                style={({ pressed }) => ({
                  flexGrow: 1, flexBasis: 120, minWidth: 120,
                  borderWidth: 2, borderRadius: 16, padding: 10, gap: 12,
                  borderColor: selected ? colors.accent : colors.border,
                  backgroundColor: selected ? colors.accentSoft : colors.surface,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <View
                  style={{ padding: 12, gap: 9, borderRadius: 10, backgroundColor: preview.background, borderColor: preview.border, borderWidth: 1 }}
                  accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: preview.accent }} />
                    <View style={{ width: '45%', height: 5, borderRadius: 3, backgroundColor: preview.text }} />
                  </View>
                  <View style={{ padding: 10, gap: 6, borderRadius: 8, backgroundColor: preview.surface, borderWidth: 1, borderColor: preview.border }}>
                    <View style={{ width: '70%', height: 4, borderRadius: 2, backgroundColor: preview.muted }} />
                    <View style={{ width: '45%', height: 4, borderRadius: 2, backgroundColor: preview.border }} />
                    <View style={{ height: 12, marginTop: 4, borderRadius: 4, backgroundColor: preview.accent }} />
                  </View>
                </View>
                <View style={[ui.between, { gap: 6 }]}>
                  <View style={[ui.row, { gap: 6, flexShrink: 1 }]}>
                    <Icon name={option === 'light' ? 'sun' : 'moon'} size={16} color={selected ? colors.accent : colors.muted} />
                    <Text style={[ui.body, { fontWeight: '700', flexShrink: 1 }]}>{option === 'light' ? 'Light' : 'Dark'}</Text>
                  </View>
                  <Icon name={selected ? 'check-circle' : 'circle'} size={18} color={selected ? colors.accent : colors.muted} />
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={[ui.small, error && { color: colors.danger }]} accessibilityLiveRegion="polite">
          {error ?? `${mode === 'light' ? 'Light' : 'Dark'} mode · applies throughout OUTDO`}
        </Text>
      </Card>
    </View>
  );
}
