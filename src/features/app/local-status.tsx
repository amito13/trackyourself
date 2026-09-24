import { Text, View } from 'react-native';
import { Icon } from '@/components/ui';
import { ui } from '@/constants/theme';
import { useData } from './data-context';

export function LocalStatus() {
  const { sync } = useData();
  const label = sync.status === 'synced' ? 'Saved on device and Supabase'
    : sync.status === 'syncing' ? 'Saved on device · uploading…'
    : sync.status === 'offline' ? 'Saved offline · uploads resume when connected'
    : sync.status === 'error' ? 'Saved on device · upload needs attention'
    : 'Saved on device · waiting to upload';
  return (
    <View style={ui.row}>
      <Icon name={sync.status === 'synced' ? 'check-circle' : sync.status === 'offline' ? 'wifi-off' : 'upload-cloud'} size={14} />
      <Text style={[ui.small, { flex: 1 }]}>{label}</Text>
    </View>
  );
}
