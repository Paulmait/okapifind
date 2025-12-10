import React, { useMemo, useCallback } from 'react';
import { FlatList, FlatListProps, ViewToken, ListRenderItemInfo } from 'react-native';
import { performance } from '../services/performance';

interface OptimizedFlatListProps<T> extends FlatListProps<T> {
  estimatedItemSize?: number;
  windowSize?: number;
  maxToRenderPerBatch?: number;
  updateCellsBatchingPeriod?: number;
  removeClippedSubviews?: boolean;
  onViewableItemsChanged?: ((info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => void) | null;
}

function OptimizedFlatList<T>({
  data,
  renderItem,
  keyExtractor,
  estimatedItemSize = 50,
  windowSize = 10,
  maxToRenderPerBatch = 5,
  updateCellsBatchingPeriod = 50,
  removeClippedSubviews = true,
  onViewableItemsChanged,
  getItemLayout,
  ...props
}: OptimizedFlatListProps<T>) {

  // Memoized keyExtractor
  const memoizedKeyExtractor = useCallback((item: T, index: number) => {
    if (keyExtractor) {
      return keyExtractor(item, index);
    }
    return `item_${index}`;
  }, [keyExtractor]);

  // Memoized renderItem with performance monitoring
  const memoizedRenderItem = useCallback((info: ListRenderItemInfo<T>) => {
    const key = memoizedKeyExtractor(info.item, info.index);

    return performance.measureSync(`render_item_${key}`, () => {
      return renderItem?.(info) || null;
    });
  }, [renderItem, memoizedKeyExtractor]);

  // Optimized getItemLayout
  const optimizedGetItemLayout = useMemo(() => {
    if (getItemLayout) {
      return getItemLayout;
    }

    // Auto-generate getItemLayout if not provided and all items are same size
    if (estimatedItemSize > 0) {
      return (_data: T[] | null | undefined, index: number) => ({
        length: estimatedItemSize,
        offset: estimatedItemSize * index,
        index,
      });
    }

    return undefined;
  }, [getItemLayout, estimatedItemSize]);

  // Performance monitoring for viewable items
  const handleViewableItemsChanged = useCallback((info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
    // Log performance metrics for visible items
    const visibleCount = info.viewableItems.length;
    performance.logMemoryUsage(`FlatList_${visibleCount}_items_visible`);

    onViewableItemsChanged?.(info);
  }, [onViewableItemsChanged]);

  // Viewability config for better performance
  const viewabilityConfig = useMemo(() => ({
    waitForInteraction: true,
    viewAreaCoveragePercentThreshold: 50,
    minimumViewTime: 100,
  }), []);

  React.useEffect(() => {
    performance.startTimer('FlatList_mount');
    return () => {
      performance.endTimer('FlatList_mount');
    };
  }, []);

  const flatListProps: any = {
    ...props,
    data,
    renderItem: memoizedRenderItem,
    keyExtractor: memoizedKeyExtractor,
    windowSize,
    maxToRenderPerBatch,
    updateCellsBatchingPeriod,
    removeClippedSubviews,
    onViewableItemsChanged: handleViewableItemsChanged,
    viewabilityConfig,
    initialNumToRender: 10,
    legacyImplementation: false,
    disableVirtualization: false,
  };

  if (optimizedGetItemLayout) {
    flatListProps.getItemLayout = optimizedGetItemLayout;
  }

  return <FlatList {...flatListProps} />;
}

export default React.memo(OptimizedFlatList) as <T>(props: OptimizedFlatListProps<T>) => React.ReactElement;