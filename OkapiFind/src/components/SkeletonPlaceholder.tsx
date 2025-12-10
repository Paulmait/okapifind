import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface SkeletonPlaceholderProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

const SkeletonPlaceholder: React.FC<SkeletonPlaceholderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E1E9EE',
  },
});

export default React.memo(SkeletonPlaceholder);

const skeletonStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapSkeleton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  bottomCardSkeleton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
  },
  buttonRowSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

// Map Screen Skeleton
export const MapScreenSkeleton: React.FC = React.memo(() => (
  <View style={skeletonStyles.container}>
    <View style={skeletonStyles.mapSkeleton}>
      <SkeletonPlaceholder height="100%" />
    </View>
    <View style={skeletonStyles.bottomCardSkeleton}>
      <SkeletonPlaceholder width="60%" height={24} style={{ marginBottom: 8 }} />
      <SkeletonPlaceholder width="40%" height={16} style={{ marginBottom: 16 }} />
      <View style={skeletonStyles.buttonRowSkeleton}>
        <SkeletonPlaceholder width="48%" height={48} borderRadius={12} />
        <SkeletonPlaceholder width="48%" height={48} borderRadius={12} />
      </View>
    </View>
  </View>
));

MapScreenSkeleton.displayName = 'MapScreenSkeleton';