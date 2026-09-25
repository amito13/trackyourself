import { Image } from 'expo-image';
import { View } from 'react-native';
import { useTheme } from '@/constants/theme';

const muscleImages: Record<string, number> = {
  chest: require('../../../assets/images/outdo/chest.png'),
  back: require('../../../assets/images/outdo/back.png'),
  shoulders: require('../../../assets/images/outdo/shoulders.png'),
  biceps: require('../../../assets/images/outdo/biceps.png'),
  triceps: require('../../../assets/images/outdo/triceps.png'),
  legs: require('../../../assets/images/outdo/legs.png'),
  core: require('../../../assets/images/outdo/core.png'),
};
const fallback = require('../../../assets/images/outdo/complete.png');

export function savedBodyParts(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((part): part is string => typeof part === 'string') : [];
  } catch { return []; }
}

/** Bundled art stays available offline and reflects the saved muscle-group snapshot. */
export function MuscleArt({ groups, size = 64 }: { groups: string[]; size?: number }) {
  const { colors } = useTheme();
  const unique = [...new Set(groups.map((group) => group.trim().toLowerCase()))].filter(Boolean);
  const secondary = unique[1];
  return (
    <View style={{ width: size, height: size, flexShrink: 0 }} accessible accessibilityLabel={unique.length ? `${unique.join(' and ')} muscle illustration` : 'Workout illustration'}>
      <Image source={muscleImages[unique[0]] ?? fallback} contentFit="contain"
        style={{ width: size, height: size, borderRadius: 14, backgroundColor: '#000000', borderWidth: 1, borderColor: colors.border }} />
      {secondary && <Image source={muscleImages[secondary] ?? fallback} contentFit="contain"
        style={{ position: 'absolute', right: -3, bottom: -3, width: size * 0.47, height: size * 0.47, borderRadius: 9, backgroundColor: '#000000', borderWidth: 2, borderColor: colors.surface }} />}
    </View>
  );
}
