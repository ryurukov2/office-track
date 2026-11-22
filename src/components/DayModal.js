import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import {
  fmtBalance,
  fmtDelta,
  fmtHM,
  fmtTime,
  isWorkday,
  KIND_LABELS,
  LABELS,
  newId,
  OFF_LABELS,
  parseKey,
  summarize,
} from '../model';
import { warn } from '../haptics';
import { SmallBtn, styles } from '../ui';

export function eventLabel(e) {
  if (e.type === 'adjust') return `✍️ ${LABELS.adjust} ${fmtDelta(e.deltaMs)}`;
  return `${LABELS[e.type]}${e.type === 'break' && e.kind ? ` · ${KIND_LABELS[e.kind]}` : ''}`;
}

export function fmtDayTitle(key) {
  return parseKey(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Edit a whole day: mark it as a day off, add/subtract time manually,
 * fix or delete single entries, or delete the whole day.
 */
export function DayModal({
  dayKeyStr,
  events,
  off,
  settings,
  initialSelectedId,
  onChange,
  onOffChange,
  onClose,
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? null);
  const [ts, setTs] = useState(0);
  const selected = events.find((e) => e.id === selectedId) ?? null;
  useEffect(() => {
    if (selected) setTs(selected.ts);
  }, [selectedId]);

  const sum = summarize(events, Date.now(), settings);
  const expected = isWorkday(dayKeyStr, settings) && !off ? settings.targetMinutes * 60_000 : 0;
  const delta = sum.countedMs - expected;

  const adjust = (min) =>
    onChange([...events, { id: newId(), type: 'adjust', ts: Date.now(), deltaMs: min * 60_000 }]);

  const deleteDay = () => {
    warn();
    Alert.alert('Delete this day?', `All entries for ${fmtDayTitle(dayKeyStr)} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await onChange([]);
          if (off) await onOffChange(null);
          onClose();
        },
      },
    ]);
  };

  const shift = (min) => setTs((t) => Math.min(Date.now(), t + min * 60_000));

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          <Text style={styles.modalTitle}>{fmtDayTitle(dayKeyStr)}</Text>
          <Text style={styles.modalTime}>
            {off && !events.length ? OFF_LABELS[off] : fmtHM(sum.countedMs)}
          </Text>
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            {events.length || expected ? `${fmtBalance(delta)} for this day` : 'Not a workday'}
            {sum.adjustMs ? ` · manual ${fmtDelta(sum.adjustMs)}` : ''}
          </Text>

          {selected ? (
            <>
              <Text style={styles.section}>{eventLabel(selected)}</Text>
              {selected.type !== 'adjust' && (
                <>
                  <Text style={[styles.modalTime, { fontSize: 36 }]}>{fmtTime(ts)}</Text>
                  {[
                    [-30, -5, -1],
                    [1, 5, 30],
                  ].map((row, i) => (
                    <View key={i} style={styles.row}>
                      {row.map((m) => (
                        <SmallBtn key={m} label={`${m > 0 ? '+' : ''}${m} min`} onPress={() => shift(m)} />
                      ))}
                    </View>
                  ))}
                </>
              )}
              <View style={[styles.row, { marginTop: 12 }]}>
                <Pressable
                  onPress={async () => {
                    await onChange(events.filter((x) => x.id !== selected.id));
                    setSelectedId(null);
                  }}
                  style={[styles.modalBtn, { backgroundColor: '#7f1d1d' }]}
                >
                  <Text style={styles.bigText}>Delete</Text>
                </Pressable>
                {selected.type !== 'adjust' && (
                  <Pressable
                    onPress={async () => {
                      await onChange(events.map((x) => (x.id === selected.id ? { ...x, ts } : x)));
                      setSelectedId(null);
                    }}
                    style={[styles.modalBtn, { backgroundColor: '#2563eb' }]}
                  >
                    <Text style={styles.bigText}>Save</Text>
                  </Pressable>
                )}
              </View>
              <Pressable onPress={() => setSelectedId(null)} style={{ padding: 8, alignItems: 'center' }}>
                <Text style={styles.muted}>← back to day</Text>
              </Pressable>
            </>
          ) : (
            <ScrollView style={{ maxHeight: 520 }}>
              <Text style={styles.section}>Day off</Text>
              <View style={[styles.row, { gap: 6 }]}>
                {Object.entries(OFF_LABELS).map(([type, label]) => (
                  <SmallBtn
                    key={type}
                    label={label.split(' ')[0]}
                    active={off === type}
                    onPress={() => onOffChange(off === type ? null : type)}
                  />
                ))}
              </View>
              <Text style={[styles.muted, { marginTop: 6 }]}>
                {off
                  ? `${OFF_LABELS[off]}: no quota expected (tap again to remove)`
                  : 'Vacation · sick · holiday · other'}
              </Text>

              <Text style={styles.section}>Manual add / subtract</Text>
              {[
                [-60, -15, -10, -5],
                [5, 10, 15, 60],
              ].map((row, i) => (
                <View key={i} style={[styles.row, { marginBottom: 8, gap: 6 }]}>
                  {row.map((m) => (
                    <SmallBtn
                      key={m}
                      label={fmtDelta(m * 60_000)}
                      color={m < 0 ? '#3b1d2a' : '#14332a'}
                      onPress={() => adjust(m)}
                    />
                  ))}
                </View>
              ))}

              <Text style={styles.section}>Entries · tap to edit</Text>
              {events.length === 0 && <Text style={styles.muted}>No entries.</Text>}
              {events.map((e) => (
                <Pressable key={e.id} onPress={() => setSelectedId(e.id)} style={styles.logRow}>
                  <Text style={styles.logTime}>{e.type === 'adjust' ? '' : fmtTime(e.ts)}</Text>
                  <Text style={styles.logText}>{eventLabel(e)}</Text>
                </Pressable>
              ))}

              <View style={[styles.row, { marginTop: 16 }]}>
                {(events.length > 0 || off) && (
                  <Pressable onPress={deleteDay} style={[styles.modalBtn, { backgroundColor: '#7f1d1d' }]}>
                    <Text style={styles.bigText}>Delete day</Text>
                  </Pressable>
                )}
                <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: '#1e2a45' }]}>
                  <Text style={styles.bigText}>Done</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
