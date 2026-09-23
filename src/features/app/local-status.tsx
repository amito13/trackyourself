import { useNetworkState } from 'expo-network';
import { Text, View } from 'react-native';
import { Icon } from '@/components/ui';
import { ui } from '@/constants/theme';
export function LocalStatus() {
  const network = useNetworkState();
  return (
    <View style={ui.row}>
      <Icon name={network.isConnected === false ? 'wifi-off' : 'smartphone'} size={14} />
      <Text style={ui.small}>
        {network.isConnected === false
          ? 'Offline · your workouts stay on this device'
          : 'Workouts saved on this device'}
      </Text>
    </View>
  );
}
