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
import PracticeSessionScreen from '../screens/PracticeSessionScreen';
import ProgressScreen from '../screens/ProgressScreen';
import LearnScreen from '../screens/LearnScreen';
import LessonScreen from '../screens/LessonScreen';
import { Colors } from '../theme';

export type SurahStackParamList = {
  SurahList: undefined;
  SurahDetail: { surahNumber: number; surahName: string; englishName: string };
};

export type PracticeStackParamList = {
  PracticeSelect: undefined;
  PracticeSession: { surahNumber: number; surahName: string; englishName: string };
};

export type LearnStackParamList = {
  LearnHome: undefined;
  Lesson: { lessonId: string };
};

export type RootTabParamList = {
  HomeTab: undefined;
  SurahsTab: undefined;
  PracticeTab: undefined;
  LearnTab: undefined;
  ProgressTab: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const SurahStack = createNativeStackNavigator<SurahStackParamList>();
const PracticeStack = createNativeStackNavigator<PracticeStackParamList>();
const LearnStack = createNativeStackNavigator<LearnStackParamList>();

const STACK_HEADER_OPTIONS = {
  headerStyle: { backgroundColor: Colors.primary },
  headerTintColor: Colors.gold,
  headerTitleStyle: { fontWeight: '700' as const, color: '#fff' },
};

function SurahNavigator() {
  return (
    <SurahStack.Navigator screenOptions={STACK_HEADER_OPTIONS}>
      <SurahStack.Screen name="SurahList" component={SurahListScreen} options={{ title: 'Surahs' }} />
      <SurahStack.Screen
        name="SurahDetail"
        component={SurahDetailScreen}
        options={({ route }) => ({ title: route.params.englishName, headerBackTitle: 'Surahs' })}
      />
    </SurahStack.Navigator>
  );
}

function PracticeNavigator() {
  return (
    <PracticeStack.Navigator screenOptions={STACK_HEADER_OPTIONS}>
      <PracticeStack.Screen name="PracticeSelect" component={PracticeScreen} options={{ title: 'Practice' }} />
      <PracticeStack.Screen
        name="PracticeSession"
        component={PracticeSessionScreen}
        options={({ route }) => ({ title: route.params.englishName, headerBackTitle: 'Practice' })}
      />
    </PracticeStack.Navigator>
  );
}

function LearnNavigator() {
  return (
    <LearnStack.Navigator screenOptions={STACK_HEADER_OPTIONS}>
      <LearnStack.Screen name="LearnHome" component={LearnScreen} options={{ title: 'Learn to Read' }} />
      <LearnStack.Screen
        name="Lesson"
        component={LessonScreen}
        options={({ route }) => ({
          title: route.params.lessonId
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (ch) => ch.toUpperCase()),
          headerBackTitle: 'Learn',
        })}
      />
    </LearnStack.Navigator>
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
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
          tabBarIcon: ({ focused, color, size }) => {
            type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
            const icons: Record<string, [IoniconName, IoniconName]> = {
              HomeTab: ['home', 'home-outline'],
              SurahsTab: ['book', 'book-outline'],
              PracticeTab: ['mic', 'mic-outline'],
              LearnTab: ['school', 'school-outline'],
              ProgressTab: ['bar-chart', 'bar-chart-outline'],
            };
            const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
            return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home' }} />
        <Tab.Screen name="SurahsTab" component={SurahNavigator} options={{ title: 'Surahs' }} />
        <Tab.Screen name="PracticeTab" component={PracticeNavigator} options={{ title: 'Practice' }} />
        <Tab.Screen name="LearnTab" component={LearnNavigator} options={{ title: 'Learn' }} />
        <Tab.Screen name="ProgressTab" component={ProgressScreen} options={{ title: 'Progress' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
