import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ChevronLeft, Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { authClient } from '@/lib/auth/auth-client';
import { useSession } from '@/lib/auth/use-session';

interface ChatMessage {
  id: string;
  text: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    image?: string;
    role: string;
  };
}

const getToken = async () => {
  try {
    const result = await authClient.getSession();
    return (result as any)?.data?.session?.token ?? null;
  } catch {
    return null;
  }
};

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: session } = useSession();
  const params = useLocalSearchParams<{
    jobId: string;
    otherName: string;
    otherAvatar: string;
  }>();

  const myId = session?.user?.id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);
  const tokenRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchMessages = useCallback(async (initial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (!tokenRef.current) {
        tokenRef.current = await getToken();
      }
      if (!tokenRef.current) return;
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/jobs/${params.jobId}/messages`,
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const fetched: ChatMessage[] = data.messages ?? [];
      setMessages((prev) => {
        if (prev.length === fetched.length && prev.at(-1)?.id === fetched.at(-1)?.id) return prev;
        return fetched;
      });
      if (initial) setLoading(false);
    } catch {
      if (initial) setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, [params.jobId]);

  // Seed token from session
  useEffect(() => {
    if (session?.session?.token) tokenRef.current = session.session.token;
    fetchMessages(true);
  }, [session?.session?.token]);

  // Poll every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchMessages(), 2000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    setInputText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (!tokenRef.current) tokenRef.current = await getToken();
      if (!tokenRef.current) return;
      await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/jobs/${params.jobId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenRef.current}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        }
      );
      await fetchMessages();
    } catch {
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMine = item.sender.id === myId;
    const prevItem = messages[index - 1];
    const showAvatar = !isMine && (index === 0 || prevItem?.sender.id !== item.sender.id);
    const isFirstInGroup = index === 0 || messages[index - 1]?.sender.id !== item.sender.id;
    const isLastInGroup = index === messages.length - 1 || messages[index + 1]?.sender.id !== item.sender.id;

    return (
      <View style={[styles.messageRow, isMine ? styles.myRow : styles.theirRow]}>
        {/* Avatar for other person */}
        {!isMine && (
          <View style={[styles.avatarSlot, !showAvatar && { opacity: 0 }]}>
            {item.sender.image ? (
              <Image
                source={{ uri: item.sender.image }}
                style={styles.msgAvatar}
              />
            ) : (
              <View style={[styles.msgAvatar, styles.msgAvatarFallback]}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {item.sender.name?.charAt(0) ?? '?'}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={[
          styles.bubble,
          isMine ? styles.myBubble : styles.theirBubble,
          isFirstInGroup && isMine && styles.myBubbleFirst,
          isFirstInGroup && !isMine && styles.theirBubbleFirst,
          isLastInGroup && isMine && styles.myBubbleLast,
          isLastInGroup && !isMine && styles.theirBubbleLast,
        ]}>
          <Text style={[styles.bubbleText, isMine && styles.myBubbleText]}>
            {item.text}
          </Text>
          <Text style={[styles.timeText, isMine && styles.myTimeText]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0F172A' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <LinearGradient
        colors={['#111827', '#0F172A']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={12}
        >
          <ChevronLeft size={24} color="#F8FAFC" />
        </Pressable>

        <View style={styles.headerCenter}>
          {params.otherAvatar ? (
            <Image
              source={{ uri: params.otherAvatar }}
              style={styles.headerAvatar}
            />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>
                {params.otherName?.charAt(0) ?? '?'}
              </Text>
            </View>
          )}
          <View style={styles.onlineDot} />
          <Text style={styles.headerName}>{params.otherName ?? 'צ\'אט'}</Text>
        </View>

        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : messages.length === 0 ? (
        <Animated.View
          entering={FadeInUp.duration(400)}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}
        >
          <Text style={{ fontSize: 36, marginBottom: 16 }}>💬</Text>
          <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
            התחל שיחה
          </Text>
          <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
            שלח הודעה ל{params.otherName} בנוגע להזמנה
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="כתוב הודעה..."
          placeholderTextColor="#475569"
          style={styles.input}
          multiline
          maxLength={500}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
          textAlign="right"
        />
        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          style={({ pressed }) => [styles.sendBtn, { opacity: (!inputText.trim() || sending) ? 0.4 : pressed ? 0.85 : 1 }]}
        >
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            style={styles.sendBtnInner}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={18} color="#fff" />
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  headerAvatarFallback: {
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    left: 26,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  headerName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },

  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 2,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 2,
  },
  myRow: {
    justifyContent: 'flex-end',
    marginLeft: 52,
  },
  theirRow: {
    justifyContent: 'flex-start',
    marginRight: 52,
  },
  avatarSlot: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  msgAvatarFallback: {
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: '#2563EB',
  },
  theirBubble: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  myBubbleFirst: { borderTopRightRadius: 4 },
  myBubbleLast: { borderBottomRightRadius: 4 },
  theirBubbleFirst: { borderTopLeftRadius: 4 },
  theirBubbleLast: { borderBottomLeftRadius: 4 },
  bubbleText: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'right',
  },
  myBubbleText: {
    color: '#F0F7FF',
  },
  timeText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'left',
  },
  myTimeText: {
    color: 'rgba(240,247,255,0.55)',
    textAlign: 'right',
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    color: '#F8FAFC',
    fontSize: 15,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    marginBottom: 2,
  },
  sendBtnInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
