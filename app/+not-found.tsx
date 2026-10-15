import React from 'react';
import { router } from 'expo-router';
import { Btn, Empty, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Empty title="This stretch of river is dry" body="That page doesn't exist." action={<Btn title="Back to Today" small onPress={() => router.replace('/')} />} />
    </Screen>
  );
}
