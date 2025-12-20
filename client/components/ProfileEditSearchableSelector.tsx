import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import ProfileEditInput from '@/components/ProfileEditInput';

interface Props {
  options?: string[];
  selected: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  single?: boolean;
  loadOptions?: (query: string) => Promise<string[]>;
  maxResults?: number;
}

const ProfileEditSearchableSelector: React.FC<Props> = ({
  options = [],
  selected,
  onChange,
  placeholder = 'Search',
  emptyText = 'No results',
  single = false,
  loadOptions,
  maxResults = 60,
}) => {
  const [query, setQuery] = useState('');
  const [remoteOptions, setRemoteOptions] = useState<string[]>(options);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<string[]>(selected);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const card = useThemeColor({}, 'secondaryBackground');
  const border = useThemeColor({}, 'separator');
  const text = useThemeColor({}, 'text');
  const secondary = useThemeColor({}, 'secondaryText');

  useEffect(() => {
    setRemoteOptions(options);
  }, [options]);

  useEffect(() => {
    setCurrent(selected);
  }, [selected]);

  useEffect(() => {
    onChange(current);
  }, [current, onChange]);

  useEffect(() => {
    if (!loadOptions) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await loadOptions(query);
        setRemoteOptions(items);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query, loadOptions]);

  const visibleOptions = useMemo(() => {
    if (loadOptions) return remoteOptions.slice(0, maxResults);
    const normalized = query.trim();
    if (!normalized) return options.slice(0, maxResults);
    return options.filter(option =>
      option.toLowerCase().includes(normalized.toLowerCase())
    ).slice(0, maxResults);
  }, [loadOptions, maxResults, options, query, remoteOptions]);

  const toggle = (value: string) => {
    if (single) {
      setCurrent([value]);
      return;
    }

    setCurrent(prev =>
      prev.includes(value)
        ? prev.filter(item => item !== value)
        : [...prev, value]
    );
  };

  return (
    <View>
      <ProfileEditInput
        value={query}
        placeholder={placeholder}
        onChangeText={setQuery}
      />

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color={secondary} />
        </View>
      )}

      {!loading && visibleOptions.length === 0 && (
        <Text style={[styles.emptyText, { color: secondary }]}>{emptyText}</Text>
      )}

      {visibleOptions.map(option => {
        const isSelected = current.includes(option);
        return (
          <TouchableOpacity
            key={option}
            onPress={() => toggle(option)}
            activeOpacity={0.85}
            style={[
              styles.option,
              {
                backgroundColor: card,
                borderColor: isSelected ? text : border,
              },
            ]}
          >
            <Text
              style={[
                styles.optionText,
                { color: isSelected ? text : secondary },
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  option: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  loading: {
    paddingVertical: 10,
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 8,
  },
});

export default ProfileEditSearchableSelector;
