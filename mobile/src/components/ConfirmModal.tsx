import React from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, StyleSheet } from 'react-native';
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
  centered?: boolean;
  /** Single dismiss button (errors, info) */
  alertOnly?: boolean;
}

function ModalIcon({ destructive }: { destructive: boolean }) {
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: destructive ? '#FEE2E2' : '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 16,
      }}
    >
      <Text style={{ fontSize: 24 }}>{destructive ? '⚠️' : '❓'}</Text>
    </View>
  );
}

function ModalCopy({ title, message }: { title: string; message: string }) {
  return (
    <>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
        {message}
      </Text>
    </>
  );
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
  alertOnly = false,
}: ConfirmModalProps) {
  const showCancel = !alertOnly && cancelText;
  const confirmBg = destructive ? '#EF4444' : '#3B82F6';

  if (centered) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
        <View style={styles.centeredRoot}>
          <Pressable style={styles.centeredBackdrop} onPress={onCancel} accessibilityRole="button" />
          <View style={styles.centeredCard}>
            <ModalIcon destructive={destructive} />
            <ModalCopy title={title} message={message} />

            {showCancel ? (
              <View style={styles.centeredActionsRow}>
                <Pressable
                  onPress={onCancel}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.centeredActionButton,
                    styles.centeredCancelButton,
                    pressed && styles.centeredButtonPressed,
                  ]}
                >
                  <Text style={styles.centeredCancelText}>{cancelText}</Text>
                </Pressable>

                <Pressable
                  onPress={onConfirm}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.centeredActionButton,
                    { backgroundColor: confirmBg },
                    pressed && styles.centeredButtonPressed,
                    loading && styles.centeredButtonDisabled,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.centeredConfirmText}>{confirmText}</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={onConfirm}
                disabled={loading}
                style={({ pressed }) => [
                  styles.centeredSingleConfirm,
                  { backgroundColor: confirmBg },
                  pressed && styles.centeredButtonPressed,
                  loading && styles.centeredButtonDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.centeredConfirmText}>{confirmText}</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
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

          <ModalIcon destructive={destructive} />
          <ModalCopy title={title} message={message} />

          <Pressable
            onPress={onConfirm}
            disabled={loading}
            style={{
              backgroundColor: confirmBg,
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 12,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{confirmText}</Text>
            )}
          </Pressable>

          {showCancel ? (
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={{ paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 15 }}>{cancelText}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centeredBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  centeredCard: {
    zIndex: 1,
    elevation: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 340,
  },
  centeredActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  centeredActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  centeredCancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  centeredCancelText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
  },
  centeredConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  centeredSingleConfirm: {
    width: '100%',
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  centeredButtonPressed: {
    opacity: 0.85,
  },
  centeredButtonDisabled: {
    opacity: 0.6,
  },
});