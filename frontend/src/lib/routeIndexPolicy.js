const NOINDEX_PREFIXES = ['/admin','/partner','/profile','/login','/register','/verify','/embed','/picker','/local-map','/collections','/security','/claim-place','/tin-bat-dong-san-cua-toi','/dang-tin-bat-dong-san','/contribute','/developers/embed'];
export function isPrivateRoute(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/';
  return path === '/map' || path === '/halo' || NOINDEX_PREFIXES.some(prefix=>path === prefix || path.startsWith(prefix + '/'));
}
