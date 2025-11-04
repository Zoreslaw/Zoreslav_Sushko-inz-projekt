import React from 'react';
import { View, StyleSheet, Pressable, Text, TouchableOpacity } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Divider } from '@/components/ui/Divider';
import { TabBarButton } from '@/components/button/TabBarButton';
import HomeIcon from '@/components/svgs/HomeIcon';
import ChatIcon from '@/components/svgs/ChatIcon';
import ProfileIcon from '@/components/svgs/ProfileIcon';

import { useThemeColor } from '@/hooks/useThemeColor';
/**
 * A custom Tab Bar, approximating your gradient background + icons.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const backgroundColor = useThemeColor({}, "background");
  const secondaryBackgroundColor = useThemeColor({}, "secondaryBackground");

  return (
    <View style={[styles.container]}>
      <Divider color={state.index === 0 ? "#1e1e1e" : secondaryBackgroundColor} />
      <View style={[styles.tabBarContainer, { backgroundColor: state.index === 0 ? "#121212" : backgroundColor }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isActive = state.index === index;
          let icon;

          switch (route.name) {
            case 'home':
              icon = <HomeIcon />;
              break;
            case 'chat':
              icon = <ChatIcon />;
              break;
            case 'profile':
              icon = <ProfileIcon />;
              break;
            default:
              icon = <HomeIcon />;
              break;
          }
          
          return (
            <TabBarButton
              key={route.key}
              label={label}
              tabName={route.name}
              onPress={() => navigation.navigate('(tabs)', { screen: route.name })}
              isActive={isActive}
              currentRoute={state.index === 0 ? 'home' : route.name}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    left: 0,
    width: '100%',
  },
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 15,
    width: '100%',
    height: 80,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 35,
    borderRadius: 20,
    backgroundColor: '#B8B8B8',
  },
  tabItemText: {
    fontFamily: 'Open Sans Hebrew',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    color: '#000000',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
});
