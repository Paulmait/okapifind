/**
 * Photo Notes Component
 * Take and manage photos of parking spots with annotations
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase-client';
import { analytics } from '../services/analytics';

const { width: screenWidth } = Dimensions.get('window');

interface Photo {
  id: string;
  uri: string;
  thumbnail?: string;
  note?: string;
  timestamp: Date;
  type: 'spot' | 'sign' | 'landmark' | 'receipt';
}

interface PhotoNotesProps {
  sessionId: string;
  onPhotosUpdated?: (photos: Photo[]) => void;
  maxPhotos?: number;
  isDarkMode?: boolean;
}

export const PhotoNotes: React.FC<PhotoNotesProps> = ({
  sessionId,
  onPhotosUpdated,
  maxPhotos = 5,
  isDarkMode = false,
}) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [noteText, setNoteText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  React.useEffect(() => {
    checkPermissions();
    loadExistingPhotos();
  }, [sessionId]);

  const checkPermissions = async () => {
    if (!permission?.granted) {
      await requestPermission();
    }
  };

  const loadExistingPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('meter_photos')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const loadedPhotos: Photo[] = data.map(photo => ({
        id: photo.id,
        uri: photo.image_path,
        note: photo.ocr_text,
        timestamp: new Date(photo.created_at),
        type: 'spot' as Photo['type'],
      }));

      setPhotos(loadedPhotos);
      onPhotosUpdated?.(loadedPhotos);
    } catch (error) {
      console.error('Failed to load photos:', error);
    }
  };

  const takePhoto = async () => {
    if (!cameraPermission) {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos');
      return;
    }

    setShowCamera(true);
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });

      setShowCamera(false);
      await processPhoto(photo.uri, 'spot');
    } catch (error) {
      console.error('Failed to capture photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await processPhoto(result.assets[0].uri, 'spot');
    }
  };

  const processPhoto = async (uri: string, type: Photo['type']) => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Limit Reached', `Maximum ${maxPhotos} photos allowed`);
      return;
    }

    try {
      // Create thumbnail
      const thumbnail = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const newPhoto: Photo = {
        id: `photo_${Date.now()}`,
        uri,
        thumbnail: thumbnail.uri,
        timestamp: new Date(),
        type,
      };

      setPhotos(prev => [...prev, newPhoto]);
      setSelectedPhoto(newPhoto);

      analytics.logEvent('photo_note_added', {
        session_id: sessionId,
        type,
        has_note: false,
      });
    } catch (error) {
      console.error('Failed to process photo:', error);
      Alert.alert('Error', 'Failed to process photo');
    }
  };

  const savePhotoWithNote = async () => {
    if (!selectedPhoto) return;

    setUploading(true);

    try {
      // Get signed upload URL
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
        'signed-upload',
        {
          body: {
            session_id: sessionId,
            content_type: 'image/jpeg',
          },
        }
      );

      if (uploadError) throw uploadError;

      // Upload image
      const response = await fetch(selectedPhoto.uri);
      const blob = await response.blob();

      const uploadResponse = await fetch(uploadData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });

      if (!uploadResponse.ok) throw new Error('Upload failed');

      // Save to database
      const { error: dbError } = await supabase.from('meter_photos').insert({
        session_id: sessionId,
        image_path: uploadData.file_path,
        ocr_text: noteText,
        rules_json: {
          type: selectedPhoto.type,
          note: noteText,
          timestamp: selectedPhoto.timestamp,
        },
      });

      if (dbError) throw dbError;

      // Update photo with note
      const updatedPhotos = photos.map(p =>
        p.id === selectedPhoto.id ? { ...p, note: noteText } : p
      );
      setPhotos(updatedPhotos);
      onPhotosUpdated?.(updatedPhotos);

      Alert.alert('Success', 'Photo saved with note');
      setSelectedPhoto(null);
      setNoteText('');

      analytics.logEvent('photo_note_saved', {
        session_id: sessionId,
        type: selectedPhoto.type,
        has_note: noteText.length > 0,
      });
    } catch (error) {
      console.error('Failed to save photo:', error);
      Alert.alert('Error', 'Failed to save photo');
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = (photoId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedPhotos = photos.filter(p => p.id !== photoId);
            setPhotos(updatedPhotos);
            onPhotosUpdated?.(updatedPhotos);

            analytics.logEvent('photo_note_deleted', {
              session_id: sessionId,
              photo_id: photoId,
            });
          },
        },
      ]
    );
  };

  const getTypeIcon = (type: Photo['type']) => {
    const icons = {
      spot: '📍',
      sign: '🚫',
      landmark: '🏛️',
      receipt: '🧾',
    };
    return icons[type] || '📷';
  };

  const styles = getStyles(isDarkMode);

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        >
          <View style={styles.cameraOverlay}>
            <TouchableOpacity
              style={styles.closeCamera}
              onPress={() => setShowCamera(false)}
            >
              <Text style={styles.closeCameraText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.cameraGuide}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
            </View>

            <TouchableOpacity style={styles.captureButton} onPress={capturePhoto}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📸 Photo Notes</Text>
        <Text style={styles.subtitle}>
          Add photos to remember your parking spot ({photos.length}/{maxPhotos})
        </Text>
      </View>

      {/* Photo grid */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.photoScroll}
      >
        {photos.map(photo => (
          <TouchableOpacity
            key={photo.id}
            style={styles.photoItem}
            onPress={() => setSelectedPhoto(photo)}
            onLongPress={() => deletePhoto(photo.id)}
          >
            <Image source={{ uri: photo.thumbnail || photo.uri }} style={styles.photoThumbnail} />
            <Text style={styles.photoType}>{getTypeIcon(photo.type)}</Text>
            {photo.note && <View style={styles.hasNoteBadge} />}
          </TouchableOpacity>
        ))}

        {photos.length < maxPhotos && (
          <View style={styles.addPhotoContainer}>
            <TouchableOpacity style={styles.addPhotoButton} onPress={takePhoto}>
              <Text style={styles.addPhotoIcon}>📷</Text>
              <Text style={styles.addPhotoText}>Take</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.addPhotoButton} onPress={pickPhoto}>
              <Text style={styles.addPhotoIcon}>🖼️</Text>
              <Text style={styles.addPhotoText}>Choose</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Photo type selector */}
      {selectedPhoto && (
        <View style={styles.noteEditor}>
          <Image source={{ uri: selectedPhoto.uri }} style={styles.selectedPhoto} />

          <View style={styles.typeSelector}>
            {(['spot', 'sign', 'landmark', 'receipt'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  selectedPhoto.type === type && styles.typeButtonActive,
                ]}
                onPress={() => {
                  setSelectedPhoto({ ...selectedPhoto, type });
                }}
              >
                <Text style={styles.typeButtonText}>
                  {getTypeIcon(type)} {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.noteInput}
            placeholder="Add a note (e.g., 'Level 2, near elevator')"
            placeholderTextColor={isDarkMode ? '#999' : '#666'}
            value={noteText}
            onChangeText={setNoteText}
            multiline
            maxLength={200}
          />

          <View style={styles.noteActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setSelectedPhoto(null);
                setNoteText('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={savePhotoWithNote}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Photo</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Quick templates */}
      <View style={styles.templates}>
        <Text style={styles.templatesTitle}>Quick notes:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            'Near elevator',
            'Level 2',
            'Blue section',
            'Behind building',
            'Street parking',
          ].map(template => (
            <TouchableOpacity
              key={template}
              style={styles.templateChip}
              onPress={() => setNoteText(template)}
            >
              <Text style={styles.templateText}>{template}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: isDarkMode ? Colors.surface : '#FFF',
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 8,
    },
    header: {
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: isDarkMode ? Colors.textPrimary : '#000',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: isDarkMode ? Colors.textSecondary : '#666',
    },
    photoScroll: {
      marginBottom: 16,
    },
    photoItem: {
      width: 80,
      height: 80,
      marginRight: 8,
      borderRadius: 8,
      overflow: 'hidden',
      position: 'relative',
    },
    photoThumbnail: {
      width: '100%',
      height: '100%',
    },
    photoType: {
      position: 'absolute',
      top: 4,
      left: 4,
      fontSize: 20,
    },
    hasNoteBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.primary,
    },
    addPhotoContainer: {
      flexDirection: 'row',
    },
    addPhotoButton: {
      width: 80,
      height: 80,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: Colors.primary,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    addPhotoIcon: {
      fontSize: 24,
      marginBottom: 4,
    },
    addPhotoText: {
      fontSize: 12,
      color: Colors.primary,
    },
    cameraContainer: {
      flex: 1,
    },
    camera: {
      flex: 1,
    },
    cameraOverlay: {
      flex: 1,
      backgroundColor: 'transparent',
      justifyContent: 'space-between',
    },
    closeCamera: {
      position: 'absolute',
      top: 50,
      right: 20,
      zIndex: 10,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeCameraText: {
      color: '#FFF',
      fontSize: 24,
    },
    cameraGuide: {
      flex: 1,
      margin: 50,
      position: 'relative',
    },
    cornerTL: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 30,
      height: 30,
      borderTopWidth: 3,
      borderLeftWidth: 3,
      borderColor: Colors.primary,
    },
    cornerTR: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 30,
      height: 30,
      borderTopWidth: 3,
      borderRightWidth: 3,
      borderColor: Colors.primary,
    },
    cornerBL: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      width: 30,
      height: 30,
      borderBottomWidth: 3,
      borderLeftWidth: 3,
      borderColor: Colors.primary,
    },
    cornerBR: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 30,
      height: 30,
      borderBottomWidth: 3,
      borderRightWidth: 3,
      borderColor: Colors.primary,
    },
    captureButton: {
      alignSelf: 'center',
      marginBottom: 30,
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: 'rgba(255,255,255,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    captureButtonInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#FFF',
    },
    noteEditor: {
      marginTop: 16,
      padding: 16,
      backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5',
      borderRadius: 12,
    },
    selectedPhoto: {
      width: '100%',
      height: 200,
      borderRadius: 8,
      marginBottom: 12,
    },
    typeSelector: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    typeButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginHorizontal: 2,
      borderRadius: 6,
      backgroundColor: isDarkMode ? '#2A2A2A' : '#E0E0E0',
      alignItems: 'center',
    },
    typeButtonActive: {
      backgroundColor: Colors.primary,
    },
    typeButtonText: {
      fontSize: 12,
      color: isDarkMode ? '#FFF' : '#333',
    },
    noteInput: {
      backgroundColor: isDarkMode ? '#2A2A2A' : '#FFF',
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: isDarkMode ? Colors.textPrimary : '#000',
      minHeight: 80,
      textAlignVertical: 'top',
    },
    noteActions: {
      flexDirection: 'row',
      marginTop: 12,
      justifyContent: 'space-between',
    },
    cancelButton: {
      flex: 1,
      marginRight: 8,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: isDarkMode ? '#3A3A3A' : '#E0E0E0',
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      color: isDarkMode ? Colors.textPrimary : '#333',
    },
    saveButton: {
      flex: 1,
      marginLeft: 8,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: Colors.primary,
      alignItems: 'center',
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#000',
    },
    templates: {
      marginTop: 12,
    },
    templatesTitle: {
      fontSize: 12,
      color: isDarkMode ? Colors.textSecondary : '#666',
      marginBottom: 8,
    },
    templateChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: 8,
      borderRadius: 16,
      backgroundColor: isDarkMode ? '#2A2A2A' : '#F0F0F0',
    },
    templateText: {
      fontSize: 12,
      color: isDarkMode ? Colors.textPrimary : '#333',
    },
  });

export default PhotoNotes;