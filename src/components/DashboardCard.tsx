import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface Feature {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: keyof RootStackParamList;
  color: string;
}

const FEATURES: Feature[] = [
  {
    id: 'send',
    title: 'Send',
    subtitle: 'Private transfers',
    icon: '↑',
    route: 'Send',
    color: '#FF5252',
  },
  {
    id: 'receive',
    title: 'Receive',
    subtitle: 'Get funds',
    icon: '↓',
    route: 'Receive',
    color: '#4CAF50',
  },
  {
    id: 'swap',
    title: 'Swap',
    subtitle: 'Exchange tokens',
    icon: '⇄',
    route: 'Swap',
    color: '#2196F3',
  },
  {
    id: 'bridge',
    title: 'Bridge',
    subtitle: 'Cross-chain',
    icon: '🌉',
    route: 'Bridge',
    color: '#9C27B0',
  },
  {
    id: 'mesh',
    title: 'Mesh',
    subtitle: 'P2P network',
    icon: '🌐',
    route: 'MeshNetwork',
    color: '#FF9800',
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Configure',
    icon: '⚙️',
    route: 'Settings',
    color: '#607D8B',
  },
];

export const DashboardCard: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const renderFeature = (feature: Feature) => (
    <TouchableOpacity
      key={feature.id}
      style={styles.featureCard}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPress={() => navigation.navigate(feature.route as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${feature.color}20` }]}>
        <Text style={[styles.icon, { color: feature.color }]}>{feature.icon}</Text>
      </View>
      <Text style={styles.featureTitle}>{feature.title}</Text>
      <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Actions</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.featuresContainer}
      >
        {FEATURES.map(renderFeature)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  featuresContainer: {
    paddingRight: 20,
  },
  featureCard: {
    width: 100,
    marginRight: 12,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 24,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  featureSubtitle: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
});
