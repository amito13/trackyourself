import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, Chip, Icon, IconButton, Notice } from '@/components/ui';
import { colors, ui } from '@/constants/theme';
import type { ExerciseSet, SetInput } from '@/db/repositories';
import { errorMessage, setLabel } from '@/utils/display';

export function SetEditor({
  set,
  previous,
  save,
  remove,
  report,
  locked,
  showPrevious,
}: {
  set: ExerciseSet;
  previous?: ExerciseSet;
  showPrevious: boolean;
  save: (input: SetInput) => Promise<void>;
  remove: () => void;
  report: (id: string, dirty: boolean) => void;
  locked: boolean;
}) {
  const [weight, setWeight] = useState(
    set.weight_kg === null ? '' : String(set.weight_kg),
  );
  const [effort, setEffort] = useState(
    String((set.tracking_type === 'duration' ? set.duration_seconds : set.reps) ?? ''),
  );
  const [bodyweight, setBodyweight] = useState(set.weight_type === 'bodyweight');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  async function persist(w: string, e: string, bw: boolean) {
    const current = ++revision.current;
    setSaving(true);
    setError(null);
    report(set.id, true);
    try {
      const number = w.replace(',', '.');
      await save({
        weightType: bw ? 'bodyweight' : 'weighted',
        weightKg: bw || !number || number === '.' ? null : Number(number),
        reps: set.tracking_type === 'reps' && e ? Number(e) : null,
        durationSeconds: set.tracking_type === 'duration' && e ? Number(e) : null,
      });
      if (current === revision.current) {
        report(set.id, false);
        setSaving(false);
      }
    } catch (error) {
      if (current === revision.current) {
        setError(errorMessage(error));
        setSaving(false);
      }
    }
  }
  return (
    <View
      style={{
        gap: 12,
        padding: 16,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: error ? colors.danger : colors.border,
      }}
    >
      <View style={ui.between}>
        <Text style={[ui.label, { color: colors.text }]}>SET {set.set_number}</Text>
        <View style={ui.row}>
          <Text style={ui.small}>
            {saving ? 'Saving…' : error ? 'Not saved' : 'Saved locally'}
          </Text>
          {!saving && !error && <Icon name="check" size={14} color={colors.success} />}
          <IconButton
            name="minus"
            label={`Remove set ${set.set_number}`}
            disabled={locked || saving || !!error}
            onPress={remove}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {showPrevious && (
          <View style={{ flex: 0.85, justifyContent: 'center', gap: 8 }}>
            <Text style={ui.label}>LAST TIME</Text>
            <Text
              style={[ui.body, { color: colors.muted, fontVariant: ['tabular-nums'] }]}
            >
              {setLabel(previous)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1.5, gap: 8 }}>
          <Text style={[ui.label, { color: colors.accent }]}>TODAY</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!bodyweight && (
              <View style={ui.flex}>
                <TextInput
                  accessibilityLabel={`Set ${set.set_number} weight in kilograms`}
                  editable={!locked}
                  style={[ui.input, { textAlign: 'center', paddingHorizontal: 4 }]}
                  placeholder="—"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={weight}
                  maxLength={11}
                  onChangeText={(text) => {
                    if (!/^\d{0,7}([.,]\d{0,3})?$/.test(text)) return;
                    setWeight(text);
                    void persist(text, effort, bodyweight);
                  }}
                />
                <Text style={[ui.small, { textAlign: 'center', marginTop: 4 }]}>kg</Text>
              </View>
            )}
            <View style={ui.flex}>
              <TextInput
                accessibilityLabel={`Set ${set.set_number} ${set.tracking_type === 'duration' ? 'seconds' : 'repetitions'}`}
                editable={!locked}
                style={[ui.input, { textAlign: 'center', paddingHorizontal: 4 }]}
                placeholder="—"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={effort}
                maxLength={6}
                onChangeText={(text) => {
                  if (!/^\d*$/.test(text)) return;
                  setEffort(text);
                  void persist(weight, text, bodyweight);
                }}
              />
              <Text style={[ui.small, { textAlign: 'center', marginTop: 4 }]}>
                {set.tracking_type === 'duration' ? 'seconds' : 'reps'}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View style={ui.row}>
        <Chip
          label="Bodyweight"
          selected={bodyweight}
          onPress={() => {
            if (locked) return;
            setBodyweight(!bodyweight);
            void persist(weight, effort, !bodyweight);
          }}
        />
      </View>
      {error && (
        <>
          <Notice error message={error} />
          <Button
            title="Retry saving this set"
            secondary
            onPress={() => void persist(weight, effort, bodyweight)}
          />
        </>
      )}
    </View>
  );
}
