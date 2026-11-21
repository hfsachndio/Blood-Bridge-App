// Builds the React Native app for the browser with react-native-web (deployed to Vercel).
// Phone-only modules are swapped for small web versions in web/shims; *.web.ts files win over *.ts.
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

const shim = (f) => path.resolve(__dirname, 'web/shims', f);
const transpile = [
  path.resolve(__dirname, 'index.web.js'), path.resolve(__dirname, 'App.tsx'), path.resolve(__dirname, 'src'), path.resolve(__dirname, 'web'),
  /node_modules[\\/](react-native-|@react-native|@react-navigation|react-native$)/,
];

module.exports = (_env, argv = {}) => ({
  mode: argv.mode || 'production',
  entry: path.resolve(__dirname, 'index.web.js'),
  output: { path: path.resolve(__dirname, 'dist'), filename: 'assets/[name].[contenthash:8].js', publicPath: '/', clean: true },
  devtool: false,
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
    alias: {
      'react-native$': 'react-native-web',
      '@react-native-firebase/app': shim('rnfb-app.ts'),
      '@react-native-firebase/auth': shim('rnfb-auth.ts'),
      '@react-native-firebase/firestore': shim('rnfb-firestore.ts'),
      '@react-native-firebase/messaging': shim('rnfb-messaging.ts'),
      '@react-native-community/geolocation': shim('geolocation.ts'),
      '@react-native-community/datetimepicker': shim('datetimepicker.tsx'),
      'react-native-maps': shim('maps.tsx'),
      'react-native-image-picker': shim('image-picker.ts'),
      'react-native-fs': shim('fs.ts'),
      'react-native-config': shim('config.ts'),
      'react-native-linear-gradient': 'react-native-web-linear-gradient',
    },
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        include: transpile,
        use: { loader: 'babel-loader', options: { cacheDirectory: true, babelrc: false, configFile: false, presets: [['module:@react-native/babel-preset', { disableImportExportTransform: true }]] } },
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.(png|jpe?g|gif|webp|svg)$/i, type: 'asset/resource', generator: { filename: 'assets/img/[name].[hash:8][ext]' } },
      { test: /\.(ttf|otf|woff2?)$/i, type: 'asset/resource', generator: { filename: 'assets/fonts/[name][ext]' } },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({ __DEV__: JSON.stringify(argv.mode === 'development'), 'process.env.NODE_ENV': JSON.stringify(argv.mode || 'production') }),
    new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'web/index.html') }),
    new CopyPlugin({
      patterns: [
        { from: 'web/public', to: '.' },
        { from: 'src/assets/fonts/*.ttf', to: 'assets/fonts/[name][ext]' },
        // Self-hosted OCR engine + English model for the CNIC reader (no third-party API).
        { from: 'node_modules/tesseract.js/dist/worker.min.js', to: 'ocr/' },
        { from: 'node_modules/tesseract.js-core/tesseract-core*lstm.wasm.js', to: 'ocr/[name][ext]' },
        { from: 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', to: 'ocr/' },
      ],
    }),
  ],
  performance: { hints: false },
  devServer: { historyApiFallback: true, port: 8081, static: path.resolve(__dirname, 'web/public') },
});
