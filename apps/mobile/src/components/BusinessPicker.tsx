import React from 'react';
import { ScrollView } from 'react-native';
import { useAuth } from '@/lib/auth';
import { Chip } from '@/components/ui';

/** Horizontal switcher between the businesses the user manages (owner/manager). */
export function BusinessPicker({ value, onChange, filter }: { value: string | null; onChange: (id: string) => void; filter?: (b: ReturnType<typeof useAuth>['businesses'][number]) => boolean }) {
  const { businesses } = useAuth();
  const list = businesses.filter((b) => b.role !== 'staff').filter(filter ?? (() => true));
  if (list.length <= 1) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
      {list.map((b) => <Chip key={b.id} label={b.name} selected={value === b.id} onPress={() => onChange(b.id)} />)}
    </ScrollView>
  );
}

export function useSelectedBusiness(initial?: string, filter?: (b: ReturnType<typeof useAuth>['businesses'][number]) => boolean) {
  const { businesses } = useAuth();
  const list = businesses.filter((b) => b.role !== 'staff').filter(filter ?? (() => true));
  const [id, setId] = React.useState<string | null>(initial ?? list[0]?.id ?? null);
  React.useEffect(() => {
    if (!id && list[0]) setId(list[0].id);
  }, [list.length]);
  return [id, setId] as const;
}
