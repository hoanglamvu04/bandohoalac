import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { getBrandSettings } from '../services/api.js';

const DEFAULT_BRAND = {
  headerLogoUrl: '/logo.svg?v=20260929-2',
  compactLogoUrl: '/pwa-icon.svg',
  footerLogoUrl: '/logo.svg?v=20260929-2',
  faviconUrl: '/pwa-icon.svg',
  headerLogoDesktopWidth: 198,
  headerLogoMobileWidth: 154,
  headerLogoCompactWidth: 38,
  footerLogoDesktopWidth: 178,
  footerLogoMobileWidth: 154,
  updatedAt: null
};

const BrandContext = createContext({
  brand: DEFAULT_BRAND,
  reloadBrand: async () => DEFAULT_BRAND
});

function normalizeBrand(value) {
  return {
    ...DEFAULT_BRAND,
    ...(value || {})
  };
}

function syncFavicon(url) {
  if (typeof document === 'undefined' || !url) return;

  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  icon.href = url;

  let apple = document.querySelector('link[rel="apple-touch-icon"]');
  if (!apple) {
    apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    document.head.appendChild(apple);
  }
  apple.href = url;
}

export function BrandProvider({ children }) {
  const [brand, setBrand] = useState(DEFAULT_BRAND);

  const reloadBrand = useCallback(async () => {
    try {
      const data = normalizeBrand(await getBrandSettings());
      setBrand(data);
      return data;
    } catch {
      setBrand((current) => current || DEFAULT_BRAND);
      return brand;
    }
  }, [brand]);

  useEffect(() => {
    reloadBrand();
  }, []);

  useEffect(() => {
    syncFavicon(brand.faviconUrl);
  }, [brand.faviconUrl]);

  const value = useMemo(
    () => ({ brand, reloadBrand }),
    [brand, reloadBrand]
  );

  return (
    <BrandContext.Provider value={value}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}

export { DEFAULT_BRAND };
