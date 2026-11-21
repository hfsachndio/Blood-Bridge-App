// Web entry (react-native-web build deployed on Vercel). Phones use index.js.
import { AppRegistry, Dimensions } from 'react-native';
import appJson from './app.json';

// On wide screens the app runs inside a 400px phone frame (see web/index.html), so screen-size
// based scaling must use the frame's size, not the browser window's.
const realGet = Dimensions.get.bind(Dimensions);
Dimensions.get = (dim) => {
  const d = realGet(dim);
  if (typeof window === 'undefined' || window.innerWidth < 700) return d;
  return { ...d, width: 400, height: Math.min(860, window.innerHeight - 48) };
};

const App = require('./App').default;
const appName = appJson.name;
AppRegistry.registerComponent(appName, () => App);
AppRegistry.runApplication(appName, { rootTag: document.getElementById('root') });
