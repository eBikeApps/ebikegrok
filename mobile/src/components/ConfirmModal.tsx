import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
  StyleSheet,
  I18nManager,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

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

  // Split multi-line messages into spaced rows for readability
  const messageLines = (message ?? '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

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
          {Platform.OS === 'ios' ? (
            <BlurView intensity={48} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.androidGlass]} />
          )}
          <View style={[StyleSheet.absoluteFill, styles.blueWash]} />

          <View style={styles.cardInner}>
            <View
              style={[
                styles.iconCircle,
                destructive ? styles.iconCircleDestructive : styles.iconCircleDefault,
              ]}
            >
              <Text style={styles.iconEmoji}>{destructive ? '⚠️' : 'ℹ️'}</Text>
            </View>

            <Text style={styles.title}>{title}</Text>

            <View style={styles.messageBlock}>
              {messageLines.length > 0 ? (
                messageLines.map((line, i) => (
                  <Text key={`${i}-${line.slice(0, 12)}`} style={styles.messageLine}>
                    {line}
                  </Text>
                ))
              ) : (
                <Text style={styles.messageLine}>{message}</Text>
              )}
            </View>

            <Pressable
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
              style={({ pressed }) => [
                styles.confirmButton,
                destructive ? styles.confirmDestructive : styles.confirmPrimary,
                loading && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              {!destructive && (
                <LinearGradient
                  colors={[
                    'rgba(96,165,250,0.95)',
                    'rgba(37,99,235,0.98)',
                    'rgba(29,78,216,1)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              {destructive && (
                <LinearGradient
                  colors={['rgba(248,113,113,0.95)', 'rgba(220,38,38,1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <LinearGradient
                colors={['rgba(255,255,255,0.35)', 'transparent']}
                style={styles.btnSheen}
              />
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmText}>{confirmText}</Text>
              )}
              <View style={styles.confirmBorder} pointerEvents="none" />
            </Pressable>

            {showCancel ? (
              <Pressable
                onPress={onCancel}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={cancelText}
                style={({ pressed }) => [
                  styles.cancelButton,
                  loading && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                {Platform.OS === 'ios' ? (
                  <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                ) : null}
                <View style={[StyleSheet.absoluteFill, styles.cancelWash]} />
                <Text style={styles.cancelText}>{cancelText}</Text>
                <View style={styles.cancelBorder} pointerEvents="none" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.cardBorder} pointerEvents="none" />
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
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 26,
    overflow: 'hidden',
    zIndex: 2,
    elevation: 16,
    shadowColor: '#2563EB',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  androidGlass: {
    backgroundColor: 'rgba(239, 246, 255, 0.94)',
  },
  blueWash: {
    backgroundColor: 'rgba(191, 219, 254, 0.38)',
  },
  cardInner: {
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(147, 197, 253, 0.55)',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  iconCircleDefault: {
    backgroundColor: 'rgba(219, 234, 254, 0.75)',
  },
  iconCircleDestructive: {
    backgroundColor: 'rgba(254, 226, 226, 0.85)',
  },
  iconEmoji: {
    fontSize: 26,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E3A8A',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.2,
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  messageBlock: {
    marginBottom: 26,
    gap: 10,
    paddingHorizontal: 4,
  },
  messageLine: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    textAlign: 'center',
    lineHeight: 24,
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  confirmButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  confirmPrimary: {
    backgroundColor: 'transparent',
  },
  confirmDestructive: {
    backgroundColor: 'transparent',
  },
  btnSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 26,
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
    textAlign: 'center',
    includeFontPadding: false,
    letterSpacing: 0.2,
  },
  confirmBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(191, 219, 254, 0.65)',
  },
  cancelButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  cancelWash: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  cancelText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    includeFontPadding: false,
  },
  cancelBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.45)',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
