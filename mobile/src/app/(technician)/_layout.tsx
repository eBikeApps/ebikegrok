import { Stack } from 'expo-router';

export default function TechnicianLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="active-job"
        options={{ presentation: 'card', gestureEnabled: false }}
      />
      <Stack.Screen
        name="invitations"
        options={{ presentation: 'modal' }}
      />
    </Stack>
  );
}
