import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

/*
 * Swipe left / right between tabs. A horizontal paging ScrollView with one full-width page
 * per tab: swiping changes the tab, and changing the tab (tab bar tap) scrolls to its page.
 * Pages mount the first time they're visited (or are next to the current one) and then
 * stay mounted, so each tab keeps its scroll position.
 *
 * <SwipePager index={i} onIndexChange={setI} count={n} renderPage={(i) => ...} />
 */
export const SwipePager = forwardRef(function SwipePager({ index, onIndexChange, count, renderPage, scrollEnabled = true }, ref) {
  const { width } = useWindowDimensions();
  const scroller = useRef(null);
  const current = useRef(index);
  const [seen, setSeen] = useState(() => new Set([index - 1, index, index + 1]));

  useImperativeHandle(ref, () => ({ scrollTo: (i, animated = true) => scroller.current?.scrollTo({ x: i * width, animated }) }));

  // tab bar tap or programmatic change
  useEffect(() => {
    setSeen((s) => (s.has(index) && s.has(index + 1) && s.has(index - 1) ? s : new Set([...s, index - 1, index, index + 1])));
    if (current.current !== index) {
      current.current = index;
      scroller.current?.scrollTo({ x: index * width, animated: true });
    }
  }, [index, width]);

  // keep the page aligned after rotation / resize
  useEffect(() => {
    scroller.current?.scrollTo({ x: current.current * width, animated: false });
  }, [width]);

  const settle = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== current.current && i >= 0 && i < count) {
      current.current = i;
      onIndexChange(i);
    }
  };

  return (
    <ScrollView
      ref={scroller}
      horizontal
      pagingEnabled
      scrollEnabled={scrollEnabled}
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={settle}
      contentOffset={{ x: index * width, y: 0 }}
      keyboardShouldPersistTaps="handled"
      overScrollMode="never"
      style={{ flex: 1 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width, flex: 1 }}>
          {seen.has(i) ? renderPage(i) : null}
        </View>
      ))}
    </ScrollView>
  );
});
