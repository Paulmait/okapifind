/**
 * Breadcrumb Gallery Component
 * Displays all landmark photos for a parking session
 * Helps users remember "Red pillar near elevator"
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { visualBreadcrumbs, VisualBreadcrumb } from '../services/visualBreadcrumbs';

interface BreadcrumbGalleryProps {
  sessionId: string;
  onBreadcrumbDeleted?: (breadcrumbId: string) => void;
  style?: object;
  editable?: boolean; // Allow deleting breadcrumbs
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMBNAIL_SIZE = (SCREEN_WIDTH - 64) / 3; // 3 columns with padding

export const BreadcrumbGallery: React.FC<BreadcrumbGalleryProps> = ({
  sessionId,
  onBreadcrumbDeleted,
  style,
  editable = true,
}) => {
  const [breadcrumbs, setBreadcrumbs] = useState<VisualBreadcrumb[]>([]);
  const [selectedBreadcrumb, setSelectedBreadcrumb] = useState<VisualBreadcrumb | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    loadBreadcrumbs();
  }, [sessionId]);

  const loadBreadcrumbs = () => {
    const loaded = visualBreadcrumbs.getBreadcrumbs(sessionId);
    setBreadcrumbs(loaded);
  };

  const handleBreadcrumbPress = async (breadcrumb: VisualBreadcrumb) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBreadcrumb(breadcrumb);
    setIsModalVisible(true);
  };

  const handleDelete = async (breadcrumb: VisualBreadcrumb) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Delete Landmark Photo',
      'Are you sure you want to delete this landmark photo?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await visualBreadcrumbs.deleteBreadcrumb(sessionId, breadcrumb.id);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadBreadcrumbs();
              setIsModalVisible(false);
              onBreadcrumbDeleted?.(breadcrumb.id);
            } catch (error) {
              console.error('[BreadcrumbGallery] Delete error:', error);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete landmark photo');
            }
          },
        },
      ]
    );
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setSelectedBreadcrumb(null);
  };

  if (breadcrumbs.length === 0) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Ionicons name="images-outline" size={48} color="#CCCCCC" />
        <Text style={styles.emptyText}>No landmark photos yet</Text>
        <Text style={styles.emptyHint}>
          Tap "Add Landmark Photo" to help you remember this location
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Landmark Photos ({breadcrumbs.length})</Text>
        <Text style={styles.subtitle}>
          {visualBreadcrumbs.getSummary(sessionId)}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
        {breadcrumbs.map((breadcrumb) => (
          <TouchableOpacity
            key={breadcrumb.id}
            onPress={() => handleBreadcrumbPress(breadcrumb)}
            style={styles.thumbnailContainer}
          >
            <Image
              source={{ uri: breadcrumb.thumbnail_uri || breadcrumb.image_uri }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
            {breadcrumb.description && (
              <Text style={styles.description} numberOfLines={2}>
                {breadcrumb.description}
              </Text>
            )}
            {breadcrumb.color_detected && (
              <View style={styles.colorBadge}>
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: breadcrumb.color_detected },
                  ]}
                />
                <Text style={styles.colorText}>{breadcrumb.color_detected}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Full-screen image modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalOverlay} onPress={closeModal} />

          <View style={styles.modalContent}>
            {selectedBreadcrumb && (
              <>
                <Image
                  source={{ uri: selectedBreadcrumb.image_uri }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />

                <View style={styles.modalInfo}>
                  {selectedBreadcrumb.description && (
                    <Text style={styles.modalDescription}>
                      {selectedBreadcrumb.description}
                    </Text>
                  )}

                  <View style={styles.modalMeta}>
                    {selectedBreadcrumb.landmark_type && (
                      <View style={styles.metaItem}>
                        <Ionicons name="location-outline" size={16} color="#666666" />
                        <Text style={styles.metaText}>
                          {selectedBreadcrumb.landmark_type}
                        </Text>
                      </View>
                    )}

                    {selectedBreadcrumb.color_detected && (
                      <View style={styles.metaItem}>
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: selectedBreadcrumb.color_detected },
                          ]}
                        />
                        <Text style={styles.metaText}>
                          {selectedBreadcrumb.color_detected}
                        </Text>
                      </View>
                    )}

                    <View style={styles.metaItem}>
                      <Ionicons
                        name={selectedBreadcrumb.uploaded ? 'cloud-done-outline' : 'cloud-offline-outline'}
                        size={16}
                        color={selectedBreadcrumb.uploaded ? '#4CAF50' : '#FFA726'}
                      />
                      <Text style={styles.metaText}>
                        {selectedBreadcrumb.uploaded ? 'Uploaded' : 'Local only'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={closeModal}
                    style={[styles.modalButton, styles.closeButton]}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>

                  {editable && (
                    <TouchableOpacity
                      onPress={() => handleDelete(selectedBreadcrumb)}
                      style={[styles.modalButton, styles.deleteButton]}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  scrollView: {
    paddingHorizontal: 16,
  },
  thumbnailContainer: {
    marginRight: 12,
    width: THUMBNAIL_SIZE,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  description: {
    marginTop: 4,
    fontSize: 12,
    color: '#666666',
  },
  colorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  colorText: {
    fontSize: 11,
    color: '#666666',
    textTransform: 'capitalize',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999999',
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 14,
    color: '#BBBBBB',
    textAlign: 'center',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: SCREEN_WIDTH - 32,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  fullImage: {
    width: '100%',
    height: 400,
    backgroundColor: '#000000',
  },
  modalInfo: {
    padding: 16,
  },
  modalDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  modalMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    color: '#666666',
    textTransform: 'capitalize',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  closeButton: {
    backgroundColor: '#F0F0F0',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default BreadcrumbGallery;
