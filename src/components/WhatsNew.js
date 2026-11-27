import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { COLORS, styles } from '../ui';

// Bump this (and the notes) when there's something new to tell after an update.
const NOTES_VERSION = '2';
const SEEN_KEY = 'whatsNewSeen';
const NOTES = [
  'Quick Settings tile that always shows your real status',
  'The daily-quota reminder now fires only once a day',
  'Swipe between tabs, with the new bottom tab bar',
];

/** Shown once after an update. A fresh install (no data yet) just records the version silently. */
export function WhatsNew({ loaded, hasData }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        if ((await AsyncStorage.getItem(SEEN_KEY)) === NOTES_VERSION) return;
        if (hasData) setShow(true);
        else await AsyncStorage.setItem(SEEN_KEY, NOTES_VERSION);
      } catch {}
    })();
  }, [loaded, hasData]);

  const close = () => {
    setShow(false);
    AsyncStorage.setItem(SEEN_KEY, NOTES_VERSION).catch(() => {});
  };

  return (
    <Modal visible={show} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.modal}>
          <Text style={[styles.modalTitle, { color: COLORS.text, fontWeight: '700' }]}>What's new</Text>
          {NOTES.map((n) => (
            <Text key={n} style={{ color: COLORS.soft, fontSize: 15 }}>
              • {n}
            </Text>
          ))}
          <Pressable onPress={close} style={[styles.modalBtn, { backgroundColor: COLORS.blue, marginTop: 8 }]}>
            <Text style={styles.bigText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
