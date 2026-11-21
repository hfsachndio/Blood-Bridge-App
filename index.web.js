// Web entry (react-native-web build deployed on Vercel). Phones use index.js.
import { Alert, AppRegistry, Dimensions } from 'react-native';
import appJson from './app.json';

// On wide screens the app runs inside a 400px phone frame (see web/index.html), so screen-size
// based scaling must use the frame's size, not the browser window's.
const realGet = Dimensions.get.bind(Dimensions);
Dimensions.get = (dim) => {
  const d = realGet(dim);
  if (typeof window === 'undefined' || window.innerWidth < 700) return d;
  return { ...d, width: 400, height: Math.min(860, window.innerHeight - 48) };
};

// react-native-web's Alert.alert does nothing; show the browser dialog and run the chosen button.
Alert.alert = (title, message, buttons) => {
  const text = [title, message].filter(Boolean).join('\n\n');
  const list = buttons && buttons.length ? buttons : [{ text: 'OK' }];
  const cancel = list.find((b) => b.style === 'cancel');
  const action = list.filter((b) => b !== cancel);
  if (list.length === 1) { window.alert(text); list[0].onPress && list[0].onPress(); return; }
  const ok = window.confirm(text + (action[0] ? `\n\nOK = ${action[0].text}` : ''));
  const chosen = ok ? action[action.length - 1] : cancel;
  if (chosen && chosen.onPress) chosen.onPress();
};

const App = require('./App').default;
const appName = appJson.name;
AppRegistry.registerComponent(appName, () => App);
AppRegistry.runApplication(appName, { rootTag: document.getElementById('root') });
