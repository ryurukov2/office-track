import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { OfficeWidget, WIDGET_NAME, widgetData } from './OfficeWidget';

/** Re-renders every Office widget on the home screen. Does nothing if none is added. */
export async function updateWidget(info) {
  if (Platform.OS !== 'android') return;
  const data = widgetData(info);
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: () => <OfficeWidget data={data} />,
  }).catch(() => {});
}
