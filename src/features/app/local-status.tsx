import { Text, View } from 'react-native';
import { Icon } from '@/components/ui';
import { ui } from '@/constants/theme';
import { useData } from './data-context';

export function LocalStatus() {
  const { sync } = useData();
  const label = sync.status === 'synced' ? 'All changes saved'
    : sync.status === 'syncing' ? 'Saving automatically…'
    : sync.status === 'offline' ? 'Saved offline · will sync when connected'
    : sync.status === 'error' ? 'Cloud save delayed · retrying automatically'
    : 'Preparing automatic save…';
  return (
    <View style={ui.row} accessibilityLiveRegion="polite">
      <Icon name={sync.status === 'synced' ? 'check-circle' : sync.status === 'offline' ? 'wifi-off' : 'upload-cloud'} size={14} />
      <Text style={[ui.small, { flex: 1 }]}>{label}</Text>
    </View>
  );
}
