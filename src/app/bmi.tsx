import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Text, TextInput, View } from 'react-native';

import { Button, Card, Header, Notice, Screen } from '@/components/ui';
import { useTheme } from '@/constants/theme';

export default function BmiScreen() {
  const { colors, ui } = useTheme();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');
  const [bmi, setBmi] = useState<number | null>(null);

  function edit(value: string, setter: (value: string) => void) {
    setter(value);
    setBmi(null);
    setError('');
  }

  function calculate() {
    const parse = (value: string) => {
      const normalized = value.trim().replace(',', '.');
      return /^(?:\d+\.?\d*|\.\d+)$/.test(normalized) ? Number(normalized) : NaN;
    };
    const cm = parse(height);
    const kg = parse(weight);
    if (!Number.isFinite(cm) || cm < 50 || cm > 300) {
      setError('Enter a height between 50 and 300 cm.');
      return;
    }
    if (!Number.isFinite(kg) || kg < 10 || kg > 700) {
      setError('Enter a weight between 10 and 700 kg.');
      return;
    }
    Keyboard.dismiss();
    setError('');
    setBmi(kg / (cm / 100) ** 2);
  }

  const category = bmi === null ? '' : bmi < 18.5 ? 'Underweight'
    : bmi < 25 ? 'Healthy weight' : bmi < 30 ? 'Overweight' : 'Obesity';

  return (
    <Screen>
      <Header title="BMI calculator" back onBack={() => router.canGoBack() ? router.back() : router.replace('/analyze')} />
      <View style={ui.smallStack}>
        <Text style={[ui.title, { letterSpacing: 0 }]}>Check your BMI.</Text>
        <Text style={ui.muted}>Body mass index</Text>
      </View>
      <View style={ui.stack}>
        <View style={ui.smallStack}>
          <Text style={ui.body}>What is your height?</Text>
          <TextInput
            accessibilityLabel="Height in centimetres"
            style={ui.input}
            placeholder="Height (cm)"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            maxLength={7}
            value={height}
            onChangeText={(value) => edit(value, setHeight)}
          />
        </View>
        <View style={ui.smallStack}>
          <Text style={ui.body}>What is your weight?</Text>
          <TextInput
            accessibilityLabel="Weight in kilograms"
            style={ui.input}
            placeholder="Weight (kg)"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            maxLength={7}
            value={weight}
            onChangeText={(value) => edit(value, setWeight)}
            onSubmitEditing={calculate}
          />
        </View>
        {error ? <Notice error message={error} /> : null}
        <Button title="Calculate BMI" icon="activity" onPress={calculate} />
      </View>
      {bmi !== null && (
        <Card>
          <View accessibilityLiveRegion="polite" style={ui.smallStack}>
            <Text style={ui.muted}>Your BMI</Text>
            <Text style={{ color: colors.accent, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {bmi.toFixed(1)}
            </Text>
            <Text style={[ui.heading, { letterSpacing: 0 }]}>{category}</Text>
          </View>
        </Card>
      )}
      <Text style={ui.small}>Categories apply to adults aged 20 and older. BMI is a screening measure, not a diagnosis, and does not distinguish muscle from fat.</Text>
    </Screen>
  );
}
