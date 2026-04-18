import React from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import SurahListScreen from '../screens/SurahListScreen';
import SurahDetailScreen from '../screens/SurahDetailScreen';
import PracticeScreen from '../screens/PracticeScreen';
import ProgressScreen from '../screens/ProgressScreen';
import { Colors } from '../theme';

export type SurahStackParamList = {
  SurahList: undefined;
  SurahDetail: {
    surahNumber: number;
    surahName: string;
    englishName: string;
  };
};

export type RootTabParamList = {
  HomeTab: undefined;
  SurahsTab: undefined;
  PracticeTab: undefined;
  ProgressTab: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const SurahStack = createNativeStackNavigator<SurahStackParamList>();

function SurahNavigator() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = isDark ? Colors.dark : Colors.light;

  return (
    <SurahStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.gold,
        headerTitleStyle: { fontWeight: '700', color: '#fff' },
      }}
    >
      <SurahStack.Screen
        name="SurahList"
        component={SurahListScreen}
        options={{ title: 'Surahs' }}
      />
      <SurahStack.Screen
        name="SurahDetail"
        component={SurahDetailScreen}
        options={({ route }) => ({
          title: route.params.englishName,
          headerBackTitle: 'Surahs',
        })}
      />
    </SurahStack.Navigator>
  );
}

export default function Navigation() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = isDark ? Colors.dark : Colors.light;

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: c.background,
      card: isDark ? Colors.dark.tabBar : Colors.light.tabBar,
      text: c.text,
      border: c.border,
      primary: Colors.gold,
      notification: Colors.gold,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: isDark ? Colors.dark.tabBar : Colors.light.tabBar,
            borderTopColor: c.border,
            borderTopWidth: 1,
            paddingBottom: 4,
            height: 60,
          },
          tabBarActiveTintColor: Colors.gold,
          tabBarInactiveTintColor: c.textMuted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
          tabBarIcon: ({ focused, color, size }) => {
            type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
            const icons: Record<string, [IoniconName, IoniconName]> = {
              HomeTab: ['home', 'home-outline'],
              SurahsTab: ['book', 'book-outline'],
              PracticeTab: ['mic', 'mic-outline'],
              ProgressTab: ['bar-chart', 'bar-chart-outline'],
            };
            const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
            return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{ title: 'Home' }}
        />
        <Tab.Screen
          name="SurahsTab"
          component={SurahNavigator}
          options={{ title: 'Surahs' }}
        />
        <Tab.Screen
          name="PracticeTab"
          component={PracticeScreen}
          options={{ title: 'Practice' }}
        />
        <Tab.Screen
          name="ProgressTab"
          component={ProgressScreen}
          options={{ title: 'Progress' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
