import { loadState, recordAction, todayInfo } from '../actions';
import { OfficeWidget, WIDGET_NAME, widgetData } from './OfficeWidget';

/*
 * Runs in the background when the widget is added, updated or one of its buttons is tapped.
 * Registered in index.js.
 */

const CLICK_ACTIONS = {
  ARRIVE: ['in'],
  SMOKE: ['break', 'smoke'],
  LUNCH: ['break', 'lunch'],
  BACK: ['back'],
  LEAVE: ['out'],
};

export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, renderWidget }) {
  if (widgetInfo.widgetName !== WIDGET_NAME || widgetAction === 'WIDGET_DELETED') return;
  if (widgetAction === 'WIDGET_CLICK' && CLICK_ACTIONS[clickAction]) {
    await recordAction(...CLICK_ACTIONS[clickAction]);
  }
  const info = todayInfo(await loadState());
  renderWidget(<OfficeWidget data={widgetData(info)} />);
}
