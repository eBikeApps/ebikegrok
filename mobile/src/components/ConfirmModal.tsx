import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
  StyleSheet,
  I18nManager,
} from 'react-native';

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
  /** @deprecated All modals use the same centered layout now */
  centered?: boolean;
  /** Single dismiss button (errors, info) */
  alertOnly?: boolean;
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
  alertOnly = false,
}: ConfirmModalProps) {
  const showCancel = !alertOnly;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelText}
        />

        <View style={styles.card} pointerEvents="box-none">
          <View
            style={[
              styles.iconCircle,
              destructive ? styles.iconCircleDestructive : styles.iconCircleDefault,
            ]}
          >
            <Text style={styles.iconEmoji}>{destructive ? '⚠️' : 'ℹ️'}</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <Pressable
            onPress={onConfirm}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={confirmText}
            style={({ pressed }) => pressed && styles.buttonPressed}
          >
            <View
              style={[
                styles.confirmButton,
                destructive ? styles.confirmDestructive : styles.confirmPrimary,
                loading && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmText}>{confirmText}</Text>
              )}
            </View>
          </Pressable>

          {showCancel ? (
            <Pressable
              onPress={onCancel}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={cancelText}
              style={({ pressed }) => pressed && styles.buttonPressed}
            >
              <View style={[styles.cancelButton, loading && styles.buttonDisabled]}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    zIndex: 2,
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  iconCircleDefault: {
    backgroundColor: '#EFF6FF',
  },
  iconCircleDestructive: {
    backgroundColor: '#FEE2E2',
  },
  iconEmoji: {
    fontSize: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  confirmButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  confirmPrimary: {
    backgroundColor: '#2563EB',
  },
  confirmDestructive: {
    backgroundColor: '#DC2626',
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    includeFontPadding: false,
  },
  cancelButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
    includeFontPadding: false,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});