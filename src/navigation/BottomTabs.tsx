import React from 'react';
import { Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { images } from '../assets/png/images';
import { scale, verticalScale } from '../utils/globalFunction';
import { COLORS } from '../utils/color';
import HomeScreen from '../screens/main/home';
import ProfileScreen from '../screens/main/profile';
import ChatScreen from '../screens/main/chat';
import SearchScreen from '../screens/main/search';
import DonateScreen from '../screens/main/donate';
import LeaderboardScreen from '../screens/main/leaderboard';
import { Text } from 'react-native';

const Tab = createBottomTabNavigator();

const BottomTabs = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = verticalScale(70);
  // Add bottom inset for 3-button nav devices so tab bar stays above system nav
  const paddingBottom = Math.max(verticalScale(5), insets.bottom);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        // Hide tab bar when keyboard is open for consistent behavior on all devices
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: tabBarHeight + paddingBottom,
          paddingBottom,
          paddingTop: verticalScale(5),
        },
        tabBarLabelStyle: {
          fontSize: scale(12),
        },
        tabBarActiveTintColor: COLORS.red600,
        tabBarInactiveTintColor: COLORS.gray300,
      }}>
      <Tab.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => (
            <Image
              source={images.homeicon}
              resizeMode="contain"
              style={{
                width: scale(30),
                height: verticalScale(30),
                tintColor: focused ? COLORS.red600 : COLORS.gray300,
              }}
            />
          ),
        }}
      />
      <Tab.Screen
        name="SearchScreen"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: ({ focused }) => (
            <Image
              source={images.searchicon}
              resizeMode="contain"
              style={{
                width: scale(30),
                height: verticalScale(30),
                tintColor: focused ? COLORS.red600 : COLORS.gray300,
              }}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ChatScreen"
        component={ChatScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ focused }) => (
            <Image
              source={images.chaticon}
              resizeMode="contain"
              style={{
                width: scale(30),
                height: verticalScale(30),
                tintColor: focused ? COLORS.red600 : COLORS.gray300,
              }}
            />
          ),
        }}
      />
      <Tab.Screen
        name="DonateScreen"
        component={DonateScreen}
        options={{
          tabBarLabel: 'Donate',
          tabBarIcon: ({ focused }) => (
            <Image
              source={images.dropleticon}
              resizeMode="contain"
              style={{
                width: scale(30),
                height: verticalScale(30),
                tintColor: focused ? COLORS.red600 : COLORS.gray300,
              }}
            />
          ),
        }}
      />
      <Tab.Screen
        name="LeaderboardScreen"
        component={LeaderboardScreen}
        options={{
          tabBarLabel: 'Rankings',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: scale(20), opacity: focused ? 1 : 0.5 }}>🏆</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => (
            <Image
              source={images.usericon}
              resizeMode="contain"
              style={{
                width: scale(30),
                height: verticalScale(30),
                tintColor: focused ? COLORS.red600 : COLORS.gray300,
              }}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabs;