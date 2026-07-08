import { KeyboardToolbar } from 'react-native-keyboard-controller';
import { useLanguageStore } from '@/lib/store';

/**
 * Global keyboard accessory — "סיום" / Done dismisses the keyboard on every TextInput.
 */
export function KeyboardDoneToolbar() {
  const t = useLanguageStore((s) => s.t);

  return (
    <KeyboardToolbar showArrows={false}>
      <KeyboardToolbar.Done text={t('done')} />
    </KeyboardToolbar>
  );
}