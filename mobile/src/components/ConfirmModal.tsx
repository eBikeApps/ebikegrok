import React from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  loading?: boolean;
  centered?: boolean; // stable centered box instead of bottom sheet (less "jumpy")
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'אישור',
  cancelText = 'ביטול',
  onConfirm,
  onCancel,
  destructive = false,
  loading = false,
  centered = false,
}: ConfirmModalProps) {
  if (centered) {
    // Stable centered box (no bottom sheet slide/jump). Inner UI kept identical.
    return (
      <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(120)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        >
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onCancel} />
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(100)}
            style={{
              backgroundColor: '#fff',
              borderRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: 32,
              width: '100%',
              maxWidth: 340,
              alignSelf: 'center',
            }}
          >
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: destructive ? '#FEE2E2' : '#EFF6FF',
              alignItems: 'center', justifyContent: 'center',
              alignSelf: 'center', marginBottom: 16,
            }}>
              <Text style={{ fontSize: 24 }}>{destructive ? '⚠️' : '❓'}</Text>
            </View>

            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
              {title}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
              {message}
            </Text>

            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={{
                backgroundColor: destructive ? '#EF4444' : '#3B82F6',
                borderRadius: 16, paddingVertical: 16,
                alignItems: 'center', marginBottom: 12,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{confirmText}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={{ paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 15 }}>{cancelText}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  }

  // Original bottom sheet (for other confirmations)
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
      >
        <Pressable style={{ flex: 1 }} onPress={onCancel} />
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          exiting={SlideOutDown.duration(250)}
          style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }}
        >
          <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

          <View style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: destructive ? '#FEE2E2' : '#EFF6FF',
            alignItems: 'center', justifyContent: 'center',
            alignSelf: 'center', marginBottom: 16,
          }}>
            <Text style={{ fontSize: 24 }}>{destructive ? '⚠️' : '❓'}</Text>
          </View>

          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
            {message}
          </Text>

          <Pressable
            onPress={onConfirm}
            disabled={loading}
            style={{
              backgroundColor: destructive ? '#EF4444' : '#3B82F6',
              borderRadius: 16, paddingVertical: 16,
              alignItems: 'center', marginBottom: 12,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{confirmText}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={onCancel}
            disabled={loading}
            style={{ paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 15 }}>{cancelText}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
