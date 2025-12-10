/**
 * Parking History Screen
 * Search and browse past parking locations with stats
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import parkingHistoryService, {
  ParkingHistoryEntry,
  SearchFilters,
  ParkingStats,
} from '../services/parkingHistoryService';

interface ParkingHistoryScreenProps {
  navigation: any;
}

export const ParkingHistoryScreen: React.FC<ParkingHistoryScreenProps> = ({
  navigation,
}) => {
  const [entries, setEntries] = useState<ParkingHistoryEntry[]>([]);
  const [stats, setStats] = useState<ParkingStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'photos'>('all');

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      searchHistory();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeFilter]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      await parkingHistoryService.initialize();
      const [historyEntries, historyStats] = await Promise.all([
        parkingHistoryService.getRecent(50),
        parkingHistoryService.getStats(),
      ]);
      setEntries(historyEntries);
      setStats(historyStats);
    } catch (error) {
      console.error('Failed to load parking history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchHistory = async () => {
    try {
      const filters: SearchFilters = {
        query: searchQuery || undefined,
        favoritesOnly: activeFilter === 'favorites',
        hasPhotos: activeFilter === 'photos',
      };

      const results = await parkingHistoryService.search(filters);
      setEntries(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleToggleFavorite = useCallback(async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newStatus = await parkingHistoryService.toggleFavorite(id);

    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, isFavorite: newStatus } : entry
      )
    );
  }, []);

  const handleDeleteEntry = useCallback((id: string, address?: string) => {
    Alert.alert(
      'Delete Entry',
      `Remove "${address || 'this location'}" from history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await parkingHistoryService.deleteEntry(id);
            setEntries((prev) => prev.filter((e) => e.id !== id));
          },
        },
      ]
    );
  }, []);

  const handleNavigateToEntry = useCallback((entry: ParkingHistoryEntry) => {
    navigation.navigate('Map', {
      destination: {
        latitude: entry.latitude,
        longitude: entry.longitude,
        address: entry.address,
      },
    });
  }, [navigation]);

  const formatDuration = (minutes?: number): string => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const renderHistoryItem = ({ item }: { item: ParkingHistoryEntry }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => handleNavigateToEntry(item)}
      onLongPress={() => handleDeleteEntry(item.id, item.address)}
      activeOpacity={0.7}
    >
      <View style={styles.historyItemMain}>
        <View style={styles.historyItemIcon}>
          <Text style={styles.historyItemEmoji}>
            {item.floorLevel ? '🏢' : '📍'}
          </Text>
        </View>
        <View style={styles.historyItemContent}>
          <Text style={styles.historyItemAddress} numberOfLines={1}>
            {item.address || `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`}
          </Text>
          <View style={styles.historyItemMeta}>
            <Text style={styles.historyItemDate}>{formatDate(item.parkedAt)}</Text>
            {item.duration && (
              <Text style={styles.historyItemDuration}>
                {formatDuration(item.duration)}
              </Text>
            )}
            {item.floorLevel && (
              <Text style={styles.historyItemFloor}>
                Floor {item.floorLevel}
              </Text>
            )}
          </View>
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {item.tags.slice(0, 3).map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      <View style={styles.historyItemActions}>
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => handleToggleFavorite(item.id)}
        >
          <Text style={styles.favoriteIcon}>
            {item.isFavorite ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
        {item.photoUrls && item.photoUrls.length > 0 && (
          <Text style={styles.photoIndicator}>📷 {item.photoUrls.length}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderStats = () => {
    if (!stats || !showStats) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalParks}</Text>
            <Text style={styles.statLabel}>Total Parks</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDuration(stats.averageDuration)}</Text>
            <Text style={styles.statLabel}>Avg Duration</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {stats.totalCost > 0 ? `$${stats.totalCost.toFixed(0)}` : '-'}
            </Text>
            <Text style={styles.statLabel}>Total Cost</Text>
          </View>
        </View>
        {stats.mostVisitedLocations.length > 0 && (
          <View style={styles.topLocations}>
            <Text style={styles.topLocationsTitle}>Top Locations</Text>
            {stats.mostVisitedLocations.slice(0, 3).map((loc, index) => (
              <View key={index} style={styles.topLocationItem}>
                <Text style={styles.topLocationRank}>{index + 1}.</Text>
                <Text style={styles.topLocationAddress} numberOfLines={1}>
                  {loc.address}
                </Text>
                <Text style={styles.topLocationCount}>{loc.count}x</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderFilters = () => (
    <View style={styles.filterContainer}>
      {(['all', 'favorites', 'photos'] as const).map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.filterButton,
            activeFilter === filter && styles.filterButtonActive,
          ]}
          onPress={() => setActiveFilter(filter)}
        >
          <Text
            style={[
              styles.filterButtonText,
              activeFilter === filter && styles.filterButtonTextActive,
            ]}
          >
            {filter === 'all' ? 'All' : filter === 'favorites' ? '★ Favorites' : '📷 Photos'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>🚗</Text>
      <Text style={styles.emptyStateTitle}>No Parking History</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery
          ? 'No results found for your search'
          : 'Your parking history will appear here'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Parking History</Text>
        <TouchableOpacity
          style={styles.statsButton}
          onPress={() => setShowStats(!showStats)}
        >
          <Text style={styles.statsButtonText}>{showStats ? '✕' : '📊'}</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search locations, notes..."
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      {renderFilters()}

      {/* Stats Panel */}
      {renderStats()}

      {/* History List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  statsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsButtonText: {
    fontSize: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#1C1C1E',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  statsContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  topLocations: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  topLocationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  topLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  topLocationRank: {
    width: 24,
    fontSize: 14,
    color: '#8E8E93',
  },
  topLocationAddress: {
    flex: 1,
    fontSize: 14,
    color: '#1C1C1E',
  },
  topLocationCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  historyItemMain: {
    flex: 1,
    flexDirection: 'row',
  },
  historyItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyItemEmoji: {
    fontSize: 24,
  },
  historyItemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  historyItemAddress: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  historyItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyItemDate: {
    fontSize: 13,
    color: '#8E8E93',
  },
  historyItemDuration: {
    fontSize: 13,
    color: '#8E8E93',
  },
  historyItemFloor: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 6,
  },
  tag: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  historyItemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  favoriteButton: {
    padding: 4,
  },
  favoriteIcon: {
    fontSize: 24,
    color: '#FFD60A',
  },
  photoIndicator: {
    fontSize: 12,
    color: '#8E8E93',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

export default ParkingHistoryScreen;
