import React, { useState, useCallback, useMemo } from 'react';
import { Image, ImageProps, View, StyleSheet, ActivityIndicator } from 'react-native';
import { performance } from '../services/performance';

interface OptimizedImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  source: { uri: string } | number;
  placeholder?: React.ReactNode;
  lazy?: boolean;
  cacheKey?: string;
  onLoad?: () => void;
  onError?: (error: any) => void;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  style,
  placeholder,
  lazy = false,
  cacheKey,
  onLoad,
  onError,
  resizeMode = 'cover',
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy);

  const imageKey = useMemo(() => {
    if (cacheKey) return cacheKey;
    if (typeof source === 'object' && source.uri) {
      return source.uri;
    }
    return String(source);
  }, [source, cacheKey]);

  const handleLoad = useCallback(() => {
    performance.endTimer(`image_load_${imageKey}`);
    setIsLoading(false);
    onLoad?.();
  }, [imageKey, onLoad]);

  const handleError = useCallback((error: any) => {
    performance.endTimer(`image_load_${imageKey}`);
    setIsLoading(false);
    setHasError(true);
    onError?.(error);
    console.warn(`Image failed to load: ${imageKey}`, error);
  }, [imageKey, onError]);

  const handleLayout = useCallback(() => {
    if (lazy && !isVisible) {
      setIsVisible(true);
      performance.startTimer(`image_load_${imageKey}`);
    }
  }, [lazy, isVisible, imageKey]);

  React.useEffect(() => {
    if (!lazy) {
      performance.startTimer(`image_load_${imageKey}`);
    }
  }, [lazy, imageKey]);

  const imageSource = useMemo(() => {
    if (typeof source === 'number') return source;

    return {
      ...source,
      cache: 'force-cache', // Enable caching
    };
  }, [source]);

  if (hasError) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          {/* Could add error icon here */}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {(!isVisible || isLoading) && (
        <View style={[styles.placeholderContainer, style]}>
          {placeholder || <ActivityIndicator size="small" color="#999" />}
        </View>
      )}

      {isVisible && (
        <Image
          {...props}
          source={imageSource}
          style={[styles.image, style]}
          resizeMode={resizeMode}
          onLoad={handleLoad}
          onError={handleError}
          // Enable native optimizations
          progressiveRenderingEnabled={true}
          fadeDuration={200}
          loadingIndicatorSource={undefined}
        />
      )}
    </View>
  );
};

// FlatList optimized image
export const FlatListOptimizedImage: React.FC<OptimizedImageProps> = React.memo((props) => (
  <OptimizedImage {...props} lazy={true} />
));

// Map marker optimized image
export const MapMarkerOptimizedImage: React.FC<OptimizedImageProps> = React.memo((props) => (
  <OptimizedImage {...props} resizeMode="contain" />
));

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default React.memo(OptimizedImage);