// react-native-fs is only used on phones (temp files for ML Kit); the web build reads data URIs directly.
const RNFS = { CachesDirectoryPath: '/tmp', writeFile: async () => {}, unlink: async () => {}, readFile: async () => '' };
export default RNFS;
