import { registerRootComponent } from 'expo';
import './src/backgroundTask';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widget/widgetTaskHandler';
import { AppRegistry } from 'react-native';
import { toggleBreak } from './src/actions';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);

// Quick Settings tile tap (modules/office-tile): start or end a break without opening the app.
// Decides from the stored status, not the tile's cached one, so it stays right after notification taps.
AppRegistry.registerHeadlessTask('OfficeTileClick', () => toggleBreak);
