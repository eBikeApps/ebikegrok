import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { AlertCircle, RotateCw } from 'lucide-react-native';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', padding: 24, justifyContent: 'center' }}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingVertical: 40 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: '#fee2e2',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <AlertCircle size={48} color="#dc2626" />
          </View>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: '#fff',
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            משהו השתבש
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: '#9ca3af',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 22,
            }}
          >
            אירעה שגיאה לא צפויה. אנא נסה שוב.
          </Text>
          {__DEV__ && this.state.error && (
            <View
              style={{
                backgroundColor: '#1f2937',
                padding: 12,
                borderRadius: 8,
                marginBottom: 24,
                width: '100%',
              }}
            >
              <Text style={{ color: '#fca5a5', fontSize: 12, fontFamily: 'monospace' }}>
                {this.state.error.message}
              </Text>
            </View>
          )}
          <Pressable
            onPress={this.reset}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#10b981',
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 12,
              opacity: pressed ? 0.85 : 1,
              gap: 8,
            })}
          >
            <RotateCw size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>נסה שוב</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}
