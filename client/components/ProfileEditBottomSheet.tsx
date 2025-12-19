import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SubmitButton } from '@/components/button/SubmitButton';
import { View } from 'react-native';

export interface ProfileEditSheetRef {
  open: (params: {
    title?: string;
    content: React.ReactNode;
    onSubmit?: () => void;
    useScrollView?: boolean;
  }) => void;
  close: () => void;
}

const ProfileEditBottomSheet = forwardRef<ProfileEditSheetRef>((_, ref) => {
  const card = useThemeColor({}, 'secondaryBackground');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'separator');
  const { height: windowHeight } = useWindowDimensions();
  const { bottom: safeBottomArea, top: safeTopArea } = useSafeAreaInsets();

  const [state, setState] = useState<{
    title?: string;
    content: React.ReactNode | null;
    onSubmit?: () => void;
    useScrollView?: boolean;
  }>({ content: null, useScrollView: true });

  const bottomSheetRef = useRef<BottomSheet>(null);
  const maxDynamicContentSize = useMemo(() => {
    const topGap = safeTopArea + 24;
    return Math.max(windowHeight - topGap, windowHeight * 0.9);
  }, [windowHeight, safeTopArea]);

  useImperativeHandle(ref, () => ({
    open: ({ title, content, onSubmit, useScrollView }) => {
      setState({
        title,
        content,
        onSubmit,
        useScrollView: useScrollView ?? true,
      });
      requestAnimationFrame(() => {
        bottomSheetRef.current?.expand();
      });
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const footerComponent = useMemo(() => {
    if (!state.onSubmit) return undefined;
    return (props: BottomSheetFooterProps) => (
      <BottomSheetFooter
        {...props}
        bottomInset={safeBottomArea}
        style={styles.footer}
      >
        <SubmitButton label="Save" onPress={state.onSubmit ?? (() => {})} />
      </BottomSheetFooter>
    );
  }, [state.onSubmit, safeBottomArea]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      enablePanDownToClose
      enableDynamicSizing
      backgroundStyle={{ backgroundColor: card }}
      handleIndicatorStyle={{ backgroundColor: border }}
      maxDynamicContentSize={maxDynamicContentSize}
      footerComponent={footerComponent}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      )}
    >
      {state.useScrollView ? (
        <BottomSheetScrollView
          contentContainerStyle={styles.contentContainer}
          bounces={false}
          enableFooterMarginAdjustment
        >
          {state.title && (
            <Text style={[styles.title, { color: text }]}>{state.title}</Text>
          )}
          {state.content}
        </BottomSheetScrollView>
      ) : (
        <View style={styles.contentContainer}>
          {state.title && (
            <Text style={[styles.title, { color: text }]}>{state.title}</Text>
          )}
          {state.content}
        </View>
      )}
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});

export default ProfileEditBottomSheet;
