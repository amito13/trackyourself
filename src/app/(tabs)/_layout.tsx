import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/theme';
export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 68 + bottomPadding,
          paddingTop: 6,
          paddingBottom: bottomPadding,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
        },
        tabBarActiveBackgroundColor: colors.accentSoft,
        tabBarItemStyle: { borderRadius: 18, marginHorizontal: 3, paddingVertical: 4, overflow: 'hidden' },
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: { fontSize: 11, lineHeight: 16, fontWeight: '600', marginBottom: 0 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Previous Data',
          tabBarIcon: ({ color, size }) => (
            <Feather name="clock" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analyze"
        options={{
          title: 'Analyze',
          tabBarIcon: ({ color, size }) => (
            <Feather name="bar-chart-2" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
