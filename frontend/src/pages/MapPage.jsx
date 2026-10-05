import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Compass,
  Construction,
  Dumbbell,
  Fuel,
  GraduationCap,
  HeartPulse,
  House,
  ExternalLink,
  Landmark,
  Layers,
  Map as MapIcon,
  MapPin,
  Mountain,
  Navigation,
  Plus,
  Route,
  Search,
  Satellite,
  ShoppingBag,
  SlidersHorizontal,
  TriangleAlert,
  UtensilsCrossed,
  Waves,
  Wrench,
  X
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import MapView from '../components/MapView.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  confirmRoadStatus,
  createContribution,
  getCategories,
  getDirections,
  getMapLayers,
  getNearbyPlaces,
  getPlace,
  getPlaces,
  getPlacesInBounds
} from '../services/api.js';
import { LOCAL_BASEMAP_OPTIONS as BASEMAP_OPTIONS } from '../localBasemap.js';
import { getBestBrowserLocation } from '../utils/geolocation.js';
import { distanceMeters, formatOpenStatus, isPlaceOpenNow } from '../utils/placeDiscovery.js';
import { REGION_PRESETS } from '../mapConfig.js';

const LAYERS = [
  { type: 'TERRAIN', label: 'Địa hình', icon: Mountain, tone: 'green' },
  { type: 'ROAD', label: 'Đường nội bộ', icon: Route, tone: 'slate' },
  { type: 'WATER', label: 'Sông / hồ', icon: Waves, tone: 'blue' },
  { type: 'BUILDING', label: 'Công trình', icon: Building2, tone: 'stone' },
  { type: 'LANDMARK', label: 'Địa danh', icon: Landmark, tone: 'green' },
  { type: 'FLOOD', label: 'Vùng ngập', icon: Waves, tone: 'cyan' },
  { type: 'ROAD_CLOSURE', label: 'Đường cấm', icon: Construction, tone: 'red' },
  { type: 'ALERT', label: 'Cảnh báo', icon: TriangleAlert, tone: 'orange' },
  { type: 'PLANNING', label: 'Quy hoạch', icon: MapIcon, tone: 'violet' },
  { type: 'EVENT', label: 'Sự kiện', icon: CalendarDays, tone: 'purple' }
];

const DEFAULT_ACTIVE = ['TERRAIN', 'WATER', 'BUILDING', 'LANDMARK', 'FLOOD', 'ROAD_CLOSURE', 'ALERT'];

const LAYER_MIN_ZOOM = {
  TERRAIN: 12,
  WATER: 12,
  PLANNING: 12.5,
  FLOOD: 12.5,
  LANDMARK: 12.5,
  ROAD: 13,
  ROAD_CLOSURE: 13,
  ALERT: 13,
  EVENT: 13,
  BUILDING: 14
};

const CATEGORY_GROUPS = [
  { id: 'food', label: 'Ăn & uống', icon: '🍽️', slugs: ['cafe', 'an-uong'] },
  {
    id: 'tourism',
    label: 'Du lịch & lưu trú',
    icon: '🏝️',
    slugs: ['homestay', 'villa', 'khu-du-lich', 'check-in', 'trai-nghiem']
  },
  {
    id: 'utilities',
    label: 'Tiện ích',
    icon: '🏥',
    slugs: ['y-te', 'truong-hoc', 'sieu-thi', 'ngan-hang-atm']
  },
  {
    id: 'mobility',
    label: 'Di chuyển',
    icon: '🚌',
    slugs: ['giao-thong', 'nhien-lieu-sac']
  },
  {
    id: 'lifestyle',
    label: 'Đời sống',
    icon: '🏟️',
    slugs: ['the-thao', 'dich-vu', 'co-quan']
  },
  {
    id: 'property',
    label: 'Nhà đất',
    icon: '🏢',
    slugs: ['bat-dong-san']
  }
];

const MOBILE_SHEET_LEVELS = ['peek', 'half', 'full'];

const MAX_PROGRESSIVE_PLACES = 400;
const VIEWPORT_PREFETCH_RATIO = 0.35;
const MAX_LOADED_VIEWPORTS = 24;

function expandViewport(viewport, ratio = VIEWPORT_PREFETCH_RATIO) {
  const width = Math.max(0, Number(viewport.east) - Number(viewport.west));
  const height = Math.max(0, Number(viewport.north) - Number(viewport.south));
  const padX = width * ratio;
  const padY = height * ratio;

  return {
    west: Number(viewport.west) - padX,
    south: Number(viewport.south) - padY,
    east: Number(viewport.east) + padX,
    north: Number(viewport.north) + padY,
    zoom: Number(viewport.zoom)
  };
}

function viewportContains(outer, inner) {
  if (!outer || !inner) return false;
  return (
    Number(inner.west) >= Number(outer.west) &&
    Number(inner.south) >= Number(outer.south) &&
    Number(inner.east) <= Number(outer.east) &&
    Number(inner.north) <= Number(outer.north)
  );
}

function placeInsideViewport(place, viewport) {
  if (!viewport) return false;
  const lng = Number(place?.lng);
  const lat = Number(place?.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;

  return (
    lng >= Number(viewport.west) &&
    lng <= Number(viewport.east) &&
    lat >= Number(viewport.south) &&
    lat <= Number(viewport.north)
  );
}

function mergeProgressivePlaces(current, incoming) {
  const merged = new Map();

  // New viewport results go first so the sidebar feels relevant to where the
  // user has just moved, while older loaded places remain available.
  for (const place of [...incoming, ...current]) {
    if (!place?.id || merged.has(place.id)) continue;
    merged.set(place.id, place);
    if (merged.size >= MAX_PROGRESSIVE_PLACES) break;
  }

  return Array.from(merged.values());
}

function normalizeViewport(viewport) {
  const round = (value, digits = 4) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const factor = 10 ** digits;
    return Math.round(n * factor) / factor;
  };

  return {
    west: round(viewport.west),
    south: round(viewport.south),
    east: round(viewport.east),
    north: round(viewport.north),
    zoom: round(viewport.zoom, 2)
  };
}

function viewportKey(viewport) {
  const normalized = normalizeViewport(viewport);
  return [
    normalized.west,
    normalized.south,
    normalized.east,
    normalized.north,
    normalized.zoom
  ].join(':');
}


const PLACE_CATEGORY_VISUALS = [
  { key: 'cafe', tone: 'cafe', icon: Coffee, aliases: ['cafe', 'coffee', 'ca phe'] },
  { key: 'food', tone: 'food', icon: UtensilsCrossed, aliases: ['an uong', 'food', 'restaurant', 'nha hang', 'quan an'] },
  { key: 'homestay', tone: 'stay', icon: House, aliases: ['homestay', 'luu tru', 'hotel', 'resort'] },
  { key: 'villa', tone: 'stay', icon: Building2, aliases: ['villa', 'biet thu'] },
  { key: 'tourism', tone: 'tourism', icon: Mountain, aliases: ['khu du lich', 'tourism', 'tourist', 'du lich'] },
  { key: 'checkin', tone: 'checkin', icon: Camera, aliases: ['check in', 'checkin', 'chup anh'] },
  { key: 'experience', tone: 'experience', icon: Compass, aliases: ['trai nghiem', 'vui choi', 'giai tri', 'experience'] },
  { key: 'school', tone: 'school', icon: GraduationCap, aliases: ['truong', 'school', 'giao duc'] },
  { key: 'health', tone: 'health', icon: HeartPulse, aliases: ['y te', 'hospital', 'medical', 'benh vien', 'phong kham'] },
  { key: 'market', tone: 'market', icon: ShoppingBag, aliases: ['sieu thi', 'cua hang', 'shop', 'market'] },
  { key: 'bank', tone: 'bank', icon: Landmark, aliases: ['ngan hang', 'atm', 'bank'] },
  { key: 'fuel', tone: 'fuel', icon: Fuel, aliases: ['nhien lieu', 'tram xang', 'cay xang', 'sac', 'fuel'] },
  { key: 'government', tone: 'government', icon: Landmark, aliases: ['co quan', 'government', 'ubnd', 'hanh chinh'] },
  { key: 'sport', tone: 'sport', icon: Dumbbell, aliases: ['the thao', 'sport', 'gym', 'fitness'] },
  { key: 'service', tone: 'service', icon: Wrench, aliases: ['dich vu', 'service', 'spa', 'salon'] },
  { key: 'transport', tone: 'transport', icon: Route, aliases: ['giao thong', 'transport', 'ben xe', 'tram xe'] },
  { key: 'property', tone: 'property', icon: Building2, aliases: ['bat dong san', 'real estate', 'nha dat'] }
];

function normalizePlaceCategory(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPlaceCategoryVisual(place) {
  const categoryValue = typeof place?.category === 'object'
    ? [place.category?.name, place.category?.slug].filter(Boolean).join(' ')
    : place?.category;
  const haystack = normalizePlaceCategory([
    categoryValue,
    place?.categorySlug,
    place?.category_slug
  ].filter(Boolean).join(' '));

  return PLACE_CATEGORY_VISUALS.find((item) =>
    item.aliases.some((alias) => haystack.includes(alias))
  ) || { key: 'default', tone: 'default', icon: MapPin };
}

function getPlaceListImage(place) {
  const candidates = [
    place?.thumbnails?.[0],
    place?.thumbnail,
    place?.cardImages?.[0],
    place?.cardImage,
    place?.images?.[0]
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim()) || '';
}

function PlaceCategoryIcon({ place, size = 24 }) {
  const visual = getPlaceCategoryVisual(place);
  const Icon = visual.icon;
  return <Icon size={size} strokeWidth={2.25} aria-hidden="true" />;
}

function formatDistance(meters) {
  const value = Number(meters) || 0;
  return value >= 1000 ? (value / 1000).toFixed(1) + ' km' : Math.round(value) + ' m';
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round((Number(seconds) || 0) / 60));
  if (minutes < 60) return minutes + ' phút';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours + ' giờ' + (rest ? ' ' + rest + ' phút' : '');
}

export default function MapPage() {
  const { isModerator, user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [places, setPlaces] = useState([]);
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(() => searchParams.get('category') || 'all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [minRating, setMinRating] = useState(() => searchParams.get('rating') || '');
  const [openNow, setOpenNow] = useState(() => searchParams.get('open') === '1');
  const [sortMode, setSortMode] = useState(() => searchParams.get('sort') || 'relevant');
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState(null);
  const [mobileSheetLevel, setMobileSheetLevel] = useState('half');
  const [activeLayers, setActiveLayers] = useState(DEFAULT_ACTIVE);
  const [basemapMode, setBasemapMode] = useState('streets');
  const [mapData, setMapData] = useState({ type: 'FeatureCollection', features: [] });
  const [viewport, setViewport] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [leftOpen, setLeftOpen] = useState(() =>
    typeof window === 'undefined'
      ? true
      : !window.matchMedia('(max-width: 760px)').matches
  );
  const [layersExpanded, setLayersExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [placeScope, setPlaceScope] = useState('viewport');
  const [placeScopeLoading, setPlaceScopeLoading] = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState('REPORT_FLOOD');
  const [reportSeverity, setReportSeverity] = useState('MEDIUM');
  const [reportReason, setReportReason] = useState('');
  const [reportLocation, setReportLocation] = useState(null);
  const [reportPhotos, setReportPhotos] = useState([]);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [selectedStatusFeature, setSelectedStatusFeature] = useState(null);
  const [statusConfirming, setStatusConfirming] = useState(false);
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);

  const [routeDestination, setRouteDestination] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  const lastPlacesRequestKeyRef = useRef('');
  const loadedPlaceBoundsRef = useRef([]);
  const lastLayersRequestKeyRef = useRef('');
  const galleryTouchStartRef = useRef(null);
  const placeRowRefs = useRef(new Map());
  const sheetDragRef = useRef(null);
  const sheetDragMovedRef = useRef(false);

  const regionId = searchParams.get('region') || 'all';
  const requestedPlaceId = searchParams.get('place') || '';
  const focusRegion = REGION_PRESETS.find((item) => item.id === regionId) || REGION_PRESETS[0];
  const categoryBySlug = useMemo(
    () => new Map(categories.map((item) => [item.slug, item])),
    [categories]
  );
  const activeCategoryGroup = useMemo(
    () => CATEGORY_GROUPS.find((group) => group.slugs.includes(category)) || null,
    [category]
  );
  const activeCategoryLabel = category === 'all'
    ? 'Danh mục'
    : categoryBySlug.get(category)?.name || activeCategoryGroup?.label || 'Danh mục';
  const advancedFilterCount = [
    category !== 'all',
    Boolean(minRating),
    sortMode !== 'relevant'
  ].filter(Boolean).length;
  const hasActiveFilters = Boolean(
    query.trim() ||
    category !== 'all' ||
    openNow ||
    minRating
  );

  useEffect(() => {
    getCategories()
      .then((data) => setCategories(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!requestedPlaceId) return undefined;

    let active = true;

    getPlace(requestedPlaceId)
      .then((place) => {
        if (!active || !place?.id) return;

        setPlaces((current) => mergeProgressivePlaces(current, [place]));
        setSelectedId(place.id);
        setPlaceScope('viewport');
        setNearbyRadius(0);

        if (
          typeof window !== 'undefined' &&
          window.matchMedia('(max-width: 760px)').matches
        ) {
          setLeftOpen(false);
        }
      })
      .catch((error) => {
        if (!active) return;
        console.warn('[Hola Maps] requested place could not be loaded:', error);
      });

    return () => {
      active = false;
    };
  }, [requestedPlaceId]);

  useEffect(() => {
    // Region/filter changes start a new progressive discovery session. Within
    // that session, panning keeps already loaded places instead of replacing
    // them on every bounds request.
    lastPlacesRequestKeyRef.current = '';
    loadedPlaceBoundsRef.current = [];
    setPlaces([]);
    setPlaceScope('viewport');
    setNearbyRadius(0);
    setSelectedId(null);
  }, [regionId, category, minRating]);

  useEffect(() => {
    const nextQuery = searchParams.get('q') || '';
    if (nextQuery !== query) setQuery(nextQuery);

    const nextCategory = searchParams.get('category') || 'all';
    if (nextCategory !== category) setCategory(nextCategory);

    const nextRating = searchParams.get('rating') || '';
    if (nextRating !== minRating) setMinRating(nextRating);

    const nextOpen = searchParams.get('open') === '1';
    if (nextOpen !== openNow) setOpenNow(nextOpen);

    const nextSort = searchParams.get('sort') || 'relevant';
    if (nextSort !== sortMode) setSortMode(nextSort);
  }, [searchParams]);

  useEffect(() => {
    if (!viewport) return undefined;

    const needle = query.trim();
    if (!needle && placeScope !== 'viewport') return undefined;

    let active = true;
    const controller = new AbortController();
    const normalizedViewport = normalizeViewport(viewport);
    const filterKey = ':category=' + category + ':rating=' + minRating;

    // Search is intentionally replacement-based because each query is a new
    // result set. Normal map exploration is progressive and cached.
    if (needle) {
      const requestKey = 'q:' + needle.toLowerCase() + filterKey;
      if (lastPlacesRequestKeyRef.current === requestKey) {
        return () => controller.abort();
      }

      const timer = window.setTimeout(() => {
        getPlaces(
          {
            q: needle,
            category,
            minRating: minRating || undefined,
            limit: 80
          },
          { signal: controller.signal }
        )
          .then((data) => {
            if (!active) return;

            const items = Array.isArray(data?.items) ? data.items : [];
            lastPlacesRequestKeyRef.current = requestKey;
            setPlaces(items);

            // Search is a discovery list first. Never auto-select a strong
            // match: users choose the place explicitly, then the detail card
            // and map focus open from that list item.
            setSelectedId(null);

            if (
              typeof window !== 'undefined' &&
              window.matchMedia('(max-width: 760px)').matches
            ) {
              setLeftOpen(true);
            }
          })
          .catch((error) => {
            if (!active || error?.name === 'AbortError') return;
            if (error?.status === 429) {
              console.warn('[Hola Maps] search rate-limited; keeping previous results');
              return;
            }
            console.warn('[Hola Maps] places search failed:', error);
          });
      }, 320);

      return () => {
        active = false;
        window.clearTimeout(timer);
        controller.abort();
      };
    }

    // Already fetched a padded area around this viewport: keep the current
    // cache and do not call the API again when the user pans back into it.
    if (loadedPlaceBoundsRef.current.some((bounds) =>
      viewportContains(bounds, normalizedViewport)
    )) {
      return () => controller.abort();
    }

    const requestViewport = expandViewport(normalizedViewport);
    const requestKey = 'bounds:' + viewportKey(requestViewport) + filterKey;

    if (lastPlacesRequestKeyRef.current === requestKey) {
      return () => controller.abort();
    }

    const timer = window.setTimeout(() => {
      getPlacesInBounds(
        {
          west: requestViewport.west,
          south: requestViewport.south,
          east: requestViewport.east,
          north: requestViewport.north,
          category,
          minRating: minRating || undefined
        },
        { signal: controller.signal }
      )
        .then((data) => {
          if (!active) return;

          const items = Array.isArray(data?.items) ? data.items : [];
          lastPlacesRequestKeyRef.current = requestKey;
          loadedPlaceBoundsRef.current = [
            requestViewport,
            ...loadedPlaceBoundsRef.current
          ].slice(0, MAX_LOADED_VIEWPORTS);

          setPlaces((current) => mergeProgressivePlaces(current, items));
        })
        .catch((error) => {
          if (!active || error?.name === 'AbortError') return;

          // Never wipe the accumulated map on transient backend/network errors.
          if (error?.status === 429) {
            console.warn('[Hola Maps] places read rate-limited; keeping progressive cache');
            return;
          }

          console.warn('[Hola Maps] places request failed:', error);
        });
    }, 260);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [viewport, query, placeScope, category, minRating]);

  useEffect(() => {
    if (!viewport || !activeLayers.length) {
      setMapData({ type: 'FeatureCollection', features: [] });
      return undefined;
    }

    const normalizedViewport = normalizeViewport(viewport);
    const visibleLayerTypes = activeLayers.filter((type) =>
      Number(normalizedViewport.zoom || 12) >= (LAYER_MIN_ZOOM[type] || 12)
    );

    if (!visibleLayerTypes.length) {
      setMapData({ type: 'FeatureCollection', features: [] });
      return undefined;
    }

    const sortedTypes = [...visibleLayerTypes].sort();
    const requestKey =
      'layers:' + sortedTypes.join(',') + ':' + viewportKey(normalizedViewport);

    if (lastLayersRequestKeyRef.current === requestKey) {
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setDataLoading(true);

      getMapLayers(
        { types: sortedTypes, bounds: normalizedViewport },
        { signal: controller.signal }
      )
        .then((data) => {
          if (!active) return;
          lastLayersRequestKeyRef.current = requestKey;
          if (data?.type === 'FeatureCollection') setMapData(data);
        })
        .catch((error) => {
          if (!active || error?.name === 'AbortError') return;

          if (error?.status === 429) {
            console.warn('[Hola Maps] layer read rate-limited; keeping cached view');
            return;
          }

          console.warn('[Hola Maps] layer request failed:', error);
        })
        .finally(() => {
          if (active) setDataLoading(false);
        });
    }, 320);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [viewport, activeLayers, statusRefreshKey]);

  const filteredPlaces = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return places
      .filter((place) => {
        if (needle) {
          const haystack = [
            place.name,
            place.category,
            place.address,
            place.description
          ].filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(needle)) return false;
        }

        if (openNow && isPlaceOpenNow(place.openingHours) !== true) {
          return false;
        }

        return true;
      })
      .map((place) => {
        if (
          !userLocation ||
          !Number.isFinite(Number(userLocation.lat)) ||
          !Number.isFinite(Number(userLocation.lng))
        ) {
          return place;
        }

        return {
          ...place,
          distanceFromUser: distanceMeters(
            userLocation.lat,
            userLocation.lng,
            place.lat,
            place.lng
          )
        };
      });
  }, [places, query, openNow, userLocation]);

  const viewportPlaceCount = useMemo(() => {
    if (!viewport || query.trim() || placeScope !== 'viewport') {
      return filteredPlaces.length;
    }
    return filteredPlaces.filter((place) => placeInsideViewport(place, viewport)).length;
  }, [filteredPlaces, viewport, query, placeScope]);

  const sidebarPlaces = useMemo(() => {
    const items = [...filteredPlaces];

    if (sortMode === 'nearest') {
      return items.sort((a, b) =>
        Number(a.distanceFromUser ?? a.distance ?? Number.POSITIVE_INFINITY) -
        Number(b.distanceFromUser ?? b.distance ?? Number.POSITIVE_INFINITY)
      );
    }

    if (sortMode === 'rating') {
      return items.sort((a, b) =>
        Number(b.rating || 0) - Number(a.rating || 0) ||
        Number(b.reviews || 0) - Number(a.reviews || 0)
      );
    }

    if (sortMode === 'recent') {
      return items.sort((a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
    }

    if (!viewport || query.trim() || placeScope !== 'viewport') {
      return items;
    }

    const centerLng = (Number(viewport.west) + Number(viewport.east)) / 2;
    const centerLat = (Number(viewport.south) + Number(viewport.north)) / 2;

    return items.sort((a, b) => {
      const aVisible = placeInsideViewport(a, viewport);
      const bVisible = placeInsideViewport(b, viewport);
      if (aVisible !== bVisible) return aVisible ? -1 : 1;

      const aLng = Number(a.lng);
      const aLat = Number(a.lat);
      const bLng = Number(b.lng);
      const bLat = Number(b.lat);
      const aDistance = ((aLng - centerLng) ** 2) + ((aLat - centerLat) ** 2);
      const bDistance = ((bLng - centerLng) ** 2) + ((bLat - centerLat) ** 2);
      return aDistance - bDistance;
    });
  }, [filteredPlaces, viewport, query, placeScope, sortMode]);

  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedId) || null,
    [places, selectedId]
  );

  const selectedImages = useMemo(() => {
    const preferred = selectedPlace?.cardImages?.length
      ? selectedPlace.cardImages
      : selectedPlace?.images || [];

    return Array.from(new Set(
      preferred.filter(
        (image) => typeof image === 'string' && image.trim()
      )
    ));
  }, [selectedPlace]);

  useEffect(() => {
    setGalleryIndex(0);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !leftOpen) return undefined;

    const timer = window.requestAnimationFrame(() => {
      placeRowRefs.current
        .get(String(selectedId))
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    return () => window.cancelAnimationFrame(timer);
  }, [selectedId, leftOpen]);

  useEffect(() => {
    if (!selectedImages.length) {
      setGalleryIndex(0);
      return;
    }
    setGalleryIndex((current) => Math.min(current, selectedImages.length - 1));
  }, [selectedImages.length]);

  function showPreviousImage() {
    if (selectedImages.length < 2) return;
    setGalleryIndex((current) =>
      current <= 0 ? selectedImages.length - 1 : current - 1
    );
  }

  function showNextImage() {
    if (selectedImages.length < 2) return;
    setGalleryIndex((current) =>
      current >= selectedImages.length - 1 ? 0 : current + 1
    );
  }

  function startGallerySwipe(event) {
    galleryTouchStartRef.current = event.touches?.[0]?.clientX ?? null;
  }

  function endGallerySwipe(event) {
    const startX = galleryTouchStartRef.current;
    const endX = event.changedTouches?.[0]?.clientX;
    galleryTouchStartRef.current = null;

    if (!Number.isFinite(startX) || !Number.isFinite(endX)) return;
    const delta = endX - startX;
    if (Math.abs(delta) < 42) return;

    if (delta < 0) showNextImage();
    else showPreviousImage();
  }

  function resetToViewportPlaces() {
    lastPlacesRequestKeyRef.current = '';
    loadedPlaceBoundsRef.current = [];
    setPlaces([]);
    setPlaceScope('viewport');
    setNearbyRadius(0);
    setSelectedId(null);
    syncDiscoveryParams({ place: null });
  }

  function viewportCenter() {
    if (!viewport) return null;
    return {
      lat: (Number(viewport.south) + Number(viewport.north)) / 2,
      lng: (Number(viewport.west) + Number(viewport.east)) / 2
    };
  }

  async function showNearMePlaces() {
    if (placeScopeLoading) return;

    setPlaceScopeLoading(true);
    setSelectedId(null);

    try {
      const age = userLocation?.timestamp
        ? Date.now() - Number(userLocation.timestamp)
        : Number.POSITIVE_INFINITY;
      const accuracy = Number(userLocation?.accuracy) || Number.POSITIVE_INFINITY;

      const location =
        userLocation && age < 120000 && accuracy <= 250
          ? userLocation
          : await getBestBrowserLocation({
              timeout: 10000,
              targetAccuracy: 60
            });

      setUserLocation(location);

      let items = [];
      let resolvedRadius = 0;

      for (const radius of [5000, 10000, 20000, 40000]) {
        const data = await getNearbyPlaces(location.lat, location.lng, radius, {
          category,
          minRating: minRating || undefined
        });
        items = Array.isArray(data?.items) ? data.items : [];
        resolvedRadius = radius;
        if (items.length >= 8 || (items.length > 0 && radius >= 10000)) break;
      }

      setPlaces(items);
      setPlaceScope('near-me');
      setNearbyRadius(resolvedRadius);
      setSortMode('nearest');
      syncDiscoveryParams({ sort: 'nearest' });

      if (
        typeof window !== 'undefined' &&
        window.matchMedia('(max-width: 760px)').matches
      ) {
        setLeftOpen(true);
        setMobileSheetLevel('half');
      }
    } catch (error) {
      console.warn('[Hola Maps] near-me request failed:', error);
    } finally {
      setPlaceScopeLoading(false);
    }
  }

  async function showNearbyPlaces() {
    const center = viewportCenter();
    if (!center || placeScopeLoading) return;

    setPlaceScopeLoading(true);
    setSelectedId(null);

    try {
      let items = [];
      let resolvedRadius = 0;

      // Expand progressively so "nearby" is useful even in sparse zones
      // without immediately dumping every place in the whole service area.
      for (const radius of [5000, 10000, 20000]) {
        const data = await getNearbyPlaces(center.lat, center.lng, radius, {
          category,
          minRating: minRating || undefined
        });
        items = Array.isArray(data?.items) ? data.items : [];
        resolvedRadius = radius;
        if (items.length >= 6 || (items.length > 0 && radius >= 10000)) break;
      }

      setPlaces(items);
      setPlaceScope('nearby');
      setNearbyRadius(resolvedRadius);
    } catch (error) {
      console.warn('[Hola Maps] nearby places request failed:', error);
    } finally {
      setPlaceScopeLoading(false);
    }
  }

  async function showAllPlaces() {
    if (placeScopeLoading) return;

    setPlaceScopeLoading(true);
    setSelectedId(null);

    try {
      const data = await getPlaces({
        category,
        minRating: minRating || undefined,
        limit: 100
      });
      setPlaces(Array.isArray(data?.items) ? data.items : []);
      setPlaceScope('all');
      setNearbyRadius(0);
    } catch (error) {
      console.warn('[Hola Maps] all places request failed:', error);
    } finally {
      setPlaceScopeLoading(false);
    }
  }

  function isMobileMapViewport() {
    return typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 760px)').matches;
  }

  function toggleDiscoveryPanel() {
    if (!isMobileMapViewport()) {
      setLeftOpen((value) => !value);
      return;
    }

    setLeftOpen((value) => {
      const next = !value;
      if (next) setMobileSheetLevel('half');
      return next;
    });
  }

  function startSheetDrag(event) {
    if (!isMobileMapViewport()) return;
    sheetDragMovedRef.current = false;
    sheetDragRef.current = {
      startY: event.clientY,
      level: mobileSheetLevel
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function finishSheetDrag(event) {
    const drag = sheetDragRef.current;
    sheetDragRef.current = null;
    if (!drag || !isMobileMapViewport()) return;

    const delta = Number(event.clientY) - Number(drag.startY);
    if (!Number.isFinite(delta) || Math.abs(delta) < 28) return;

    sheetDragMovedRef.current = true;
    const startIndex = MOBILE_SHEET_LEVELS.indexOf(drag.level);
    const step = Math.abs(delta) > 150 ? 2 : 1;
    const direction = delta < 0 ? 1 : -1;
    const nextIndex = Math.min(
      MOBILE_SHEET_LEVELS.length - 1,
      Math.max(0, startIndex + direction * step)
    );

    setMobileSheetLevel(MOBILE_SHEET_LEVELS[nextIndex]);
    setLeftOpen(true);
  }

  function cycleSheetLevel() {
    if (sheetDragMovedRef.current) {
      sheetDragMovedRef.current = false;
      return;
    }
    const index = MOBILE_SHEET_LEVELS.indexOf(mobileSheetLevel);
    setMobileSheetLevel(MOBILE_SHEET_LEVELS[(index + 1) % MOBILE_SHEET_LEVELS.length]);
  }

  function clearDiscoveryFilters() {
    lastPlacesRequestKeyRef.current = '';
    loadedPlaceBoundsRef.current = [];
    setQuery('');
    setCategory('all');
    setOpenNow(false);
    setMinRating('');
    setSortMode('relevant');
    setSelectedId(null);
    setHoveredPlaceId(null);
    setPlaceScope('viewport');
    setNearbyRadius(0);
    setPlaces([]);
    syncDiscoveryParams({
      q: null,
      category: null,
      open: null,
      rating: null,
      sort: null,
      place: null
    });
  }

  function syncDiscoveryParams(next = {}) {
    const params = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === null || value === '' || value === 'all') {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }

    setSearchParams(params, { replace: true });
  }

  function handleQueryChange(value) {
    const wasSearching = Boolean(query.trim());
    const willSearch = Boolean(value.trim());

    if (
      willSearch &&
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 760px)').matches
    ) {
      setLeftOpen(true);
      setMobileSheetLevel('full');
    }

    if (placeScope !== 'viewport') {
      lastPlacesRequestKeyRef.current = '';
      loadedPlaceBoundsRef.current = [];
      setPlaces([]);
      setPlaceScope('viewport');
      setNearbyRadius(0);
    }

    // Entering/leaving search changes between replacement results and
    // progressive viewport results, so start with a clean cache boundary.
    if (wasSearching !== willSearch) {
      lastPlacesRequestKeyRef.current = '';
      loadedPlaceBoundsRef.current = [];
      setPlaces([]);
      setSelectedId(null);
    }

    if (willSearch) {
      setSelectedId(null);
    }

    setQuery(value);
    syncDiscoveryParams({
      q: value.trim() || null,
      // Typing a new search always leaves any previously selected place.
      place: null
    });
  }

  function handleCategoryChange(value) {
    lastPlacesRequestKeyRef.current = '';
    setSelectedId(null);
    setPlaceScope('viewport');
    setCategory(value);
    syncDiscoveryParams({ category: value, place: null });
  }

  function handleRatingChange(value) {
    lastPlacesRequestKeyRef.current = '';
    setSelectedId(null);
    setPlaceScope('viewport');
    setMinRating(value);
    syncDiscoveryParams({ rating: value, place: null });
  }

  function handleOpenNowToggle() {
    const next = !openNow;
    setOpenNow(next);
    if (selectedPlace && next && isPlaceOpenNow(selectedPlace.openingHours) !== true) {
      setSelectedId(null);
    }
    syncDiscoveryParams({ open: next ? '1' : null });
  }

  function handleSortChange(value) {
    setSortMode(value);
    syncDiscoveryParams({ sort: value === 'relevant' ? null : value });
  }

  function clearAdvancedFilters() {
    lastPlacesRequestKeyRef.current = '';
    loadedPlaceBoundsRef.current = [];
    setSelectedId(null);
    setPlaceScope('viewport');
    setCategory('all');
    setMinRating('');
    setSortMode('relevant');
    syncDiscoveryParams({
      category: null,
      rating: null,
      sort: null,
      place: null
    });
  }

  function togglePlaceSelection(place) {
    if (!place) return;

    const nextSelected = selectedId === place.id ? null : place.id;
    setSelectedId(nextSelected);
    syncDiscoveryParams({ place: nextSelected || null });

    if (
      nextSelected &&
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 760px)').matches
    ) {
      setLeftOpen(false);
    }
  }

  function toggleLayer(type) {
    setActiveLayers((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type]
    );
  }

  function openRoadStatusReport() {
    const center = viewportCenter();
    if (center) setReportLocation(center);
    setReportOpen(true);
  }

  async function useMyLocationForReport() {
    try {
      const location = await getBestBrowserLocation({
        timeout: 10000,
        targetAccuracy: 60
      });
      setUserLocation(location);
      setReportLocation({ lat: location.lat, lng: location.lng });
      showToast('Đã lấy vị trí hiện tại cho báo cáo.', 'success');
    } catch (error) {
      showToast(error.message || 'Không lấy được vị trí hiện tại.', 'error');
    }
  }

  async function submitRoadStatusReport(event) {
    event.preventDefault();
    if (!user) {
      showToast('Bạn cần đăng nhập để gửi báo cáo tình trạng.', 'error');
      return;
    }

    const location = reportLocation || viewportCenter();
    if (!location) {
      showToast('Chưa xác định được vị trí báo cáo.', 'error');
      return;
    }
    if (!reportReason.trim()) {
      showToast('Hãy mô tả ngắn tình trạng thực tế.', 'error');
      return;
    }

    setReportSubmitting(true);
    try {
      await createContribution({
        type: reportType,
        location,
        reason: reportReason.trim(),
        severity: reportSeverity,
        photos: reportPhotos
      });

      setReportOpen(false);
      setReportReason('');
      setReportPhotos([]);
      lastLayersRequestKeyRef.current = '';
      setStatusRefreshKey((value) => value + 1);
      showToast(
        'Đã đăng báo cáo cộng đồng. Người ở gần có thể xác nhận tình trạng này.',
        'success'
      );
    } catch (error) {
      showToast(error.message || 'Không gửi được báo cáo.', 'error');
    } finally {
      setReportSubmitting(false);
    }
  }

  async function confirmSelectedStatus(verdict) {
    if (!selectedStatusFeature?.reportId || statusConfirming) return;
    if (!user) {
      showToast('Bạn cần đăng nhập để xác nhận tình trạng.', 'error');
      return;
    }

    setStatusConfirming(true);
    try {
      const result = await confirmRoadStatus(
        selectedStatusFeature.reportId,
        verdict
      );

      if (result.communityState === 'RESOLVED') {
        setSelectedStatusFeature(null);
        showToast('Cộng đồng đã xác nhận tình trạng này đã hết.', 'success');
      } else {
        setSelectedStatusFeature((current) => current ? {
          ...current,
          activeConfirmations: result.activeConfirmations,
          resolvedConfirmations: result.resolvedConfirmations
        } : current);
        showToast(
          verdict === 'STILL_ACTIVE' ? 'Đã xác nhận: vẫn còn.' : 'Đã xác nhận: đã hết.',
          'success'
        );
      }

      lastLayersRequestKeyRef.current = '';
      setStatusRefreshKey((value) => value + 1);
    } catch (error) {
      showToast(error.message || 'Không thể xác nhận báo cáo.', 'error');
    } finally {
      setStatusConfirming(false);
    }
  }

  async function startDirections(place) {
    if (!place) return;

    setSelectedId(place.id);
    syncDiscoveryParams({ place: place.id });
    setRouteDestination(place);
    setRouteLoading(true);
    setRouteError('');

    try {
      const locationAge = userLocation?.timestamp
        ? Date.now() - Number(userLocation.timestamp)
        : Number.POSITIVE_INFINITY;
      const cachedAccuracy = Number(userLocation?.accuracy) || Number.POSITIVE_INFINITY;
      const canReuseLocation =
        userLocation &&
        locationAge < 60000 &&
        cachedAccuracy <= 100;

      const origin = canReuseLocation
        ? userLocation
        : await getBestBrowserLocation({
            timeout: 10000,
            targetAccuracy: 50
          });

      setUserLocation(origin);

      const route = await getDirections({
        originLat: origin.lat,
        originLng: origin.lng,
        destinationLat: Number(place.lat),
        destinationLng: Number(place.lng),
        profile: 'driving'
      });

      setRouteData(route);
    } catch (error) {
      setRouteData(null);
      setRouteError(error.message || 'Không tính được tuyến đường.');
    } finally {
      setRouteLoading(false);
    }
  }

  function clearRoute() {
    setRouteData(null);
    setRouteDestination(null);
    setRouteError('');
  }

  const googleDirectionsUrl = routeDestination && userLocation
    ? 'https://www.google.com/maps/dir/?api=1&origin=' +
      userLocation.lat + ',' + userLocation.lng +
      '&destination=' + routeDestination.lat + ',' + routeDestination.lng +
      '&travelmode=driving'
    : '';

  return (
    <main className="hm-workspace">
      <MapView
        places={filteredPlaces}
        selectedPlaceId={selectedId}
        hoveredPlaceId={hoveredPlaceId}
        onSelectPlace={togglePlaceSelection}
        onHoverPlace={setHoveredPlaceId}
        onSelectStatusFeature={setSelectedStatusFeature}
        onUserLocation={setUserLocation}
        userLocation={userLocation}
        route={routeData}
        mapData={mapData}
        activeLayers={activeLayers}
        basemapMode={basemapMode}
        onViewportChange={setViewport}
        focusRegion={focusRegion}
      />

      <header className="hm-map-topbar">
        <button
          className="hm-map-menu"
          type="button"
          onClick={toggleDiscoveryPanel}
          aria-label="Mở lớp dữ liệu"
        >
          <Layers size={19} />
        </button>

        <div className="hm-map-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Tìm địa điểm, tuyến đường, khu vực..."
          />
          {query && (
            <button type="button" onClick={() => handleQueryChange('')} aria-label="Xóa tìm kiếm">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="hm-discovery-filters">
          <button
            type="button"
            className={placeScope === 'near-me' ? 'hm-quick-filter active' : 'hm-quick-filter'}
            onClick={() => placeScope === 'near-me' ? resetToViewportPlaces() : showNearMePlaces()}
            disabled={placeScopeLoading}
          >
            <Navigation size={14} />
            <span>{placeScope === 'near-me' ? 'Đang gần tôi' : 'Gần tôi'}</span>
          </button>

          <button
            type="button"
            className={openNow ? 'hm-quick-filter active' : 'hm-quick-filter'}
            onClick={handleOpenNowToggle}
          >
            <Clock3 size={14} />
            <span>Đang mở</span>
          </button>

          <div className="hm-filter-menu">
            <button
              type="button"
              className={advancedFilterCount ? 'hm-filter-trigger active' : 'hm-filter-trigger'}
              onClick={() => setFilterMenuOpen((value) => !value)}
              aria-expanded={filterMenuOpen}
              aria-label="Mở bộ lọc địa điểm"
            >
              <SlidersHorizontal size={15} />
              <span>Bộ lọc</span>
              {advancedFilterCount > 0 && (
                <b className="hm-filter-count">{advancedFilterCount}</b>
              )}
              <ChevronDown size={14} />
            </button>

            {filterMenuOpen && (
              <div className="hm-filter-popover">
                <div className="hm-filter-popover-head">
                  <div>
                    <small>TÙY CHỈNH HIỂN THỊ</small>
                    <strong>Bộ lọc địa điểm</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterMenuOpen(false)}
                    aria-label="Đóng bộ lọc"
                  >
                    <X size={16} />
                  </button>
                </div>

                <label className="hm-filter-field">
                  <span>Danh mục</span>
                  <select
                    value={category}
                    onChange={(event) => handleCategoryChange(event.target.value)}
                  >
                    <option value="all">Tất cả danh mục</option>
                    {categories.map((item) => (
                      <option key={item.slug} value={item.slug}>{item.name}</option>
                    ))}
                  </select>
                </label>

                <div className="hm-filter-popover-grid">
                  <label className="hm-filter-field">
                    <span>Đánh giá</span>
                    <select
                      value={minRating}
                      onChange={(event) => handleRatingChange(event.target.value)}
                    >
                      <option value="">Mọi đánh giá</option>
                      <option value="4">★ 4.0+</option>
                      <option value="4.5">★ 4.5+</option>
                    </select>
                  </label>

                  <label className="hm-filter-field">
                    <span>Sắp xếp</span>
                    <select
                      value={sortMode}
                      onChange={(event) => handleSortChange(event.target.value)}
                    >
                      <option value="relevant">Phù hợp</option>
                      <option value="nearest" disabled={!userLocation}>Gần nhất</option>
                      <option value="rating">Đánh giá cao</option>
                      <option value="recent">Mới cập nhật</option>
                    </select>
                  </label>
                </div>

                <div className="hm-filter-popover-footer">
                  <span>
                    {advancedFilterCount
                      ? advancedFilterCount + ' bộ lọc nâng cao đang bật'
                      : 'Chưa có bộ lọc nâng cao'}
                  </span>
                  {advancedFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        clearAdvancedFilters();
                        setFilterMenuOpen(false);
                      }}
                    >
                      Đặt lại
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            className="hm-report-status"
            type="button"
            onClick={openRoadStatusReport}
            title="Báo ngập, đường cấm hoặc sự cố"
          >
            <TriangleAlert size={16} />
            <span>Báo tình trạng</span>
          </button>
        </div>

        <Link className="hm-add-place" to="/contribute" title="Thêm địa điểm">
          <Plus size={17} />
          <span>Thêm địa điểm</span>
        </Link>
      </header>

      {selectedStatusFeature && (
        <aside className="hm-live-status-card">
          <button
            className="hm-live-status-close"
            type="button"
            onClick={() => setSelectedStatusFeature(null)}
            aria-label="Đóng thông tin tình trạng"
          >
            <X size={16} />
          </button>
          <span className="hm-live-status-kicker">
            {selectedStatusFeature.sourceLabel || 'Cộng đồng báo cáo'}
          </span>
          <strong>{selectedStatusFeature.name || 'Tình trạng khu vực'}</strong>
          {selectedStatusFeature.description && <p>{selectedStatusFeature.description}</p>}
          <div className="hm-live-status-meta">
            <span>
              {selectedStatusFeature.verificationStatus === 'VERIFIED'
                ? '✓ Đã xác minh'
                : 'Đang chờ xác minh'}
            </span>
            <span>
              {Number(selectedStatusFeature.activeConfirmations || 0)} vẫn còn ·{' '}
              {Number(selectedStatusFeature.resolvedConfirmations || 0)} đã hết
            </span>
          </div>
          <div className="hm-live-status-actions">
            <button
              type="button"
              disabled={statusConfirming}
              onClick={() => confirmSelectedStatus('STILL_ACTIVE')}
            >
              Vẫn còn
            </button>
            <button
              type="button"
              disabled={statusConfirming}
              onClick={() => confirmSelectedStatus('RESOLVED')}
            >
              Đã hết
            </button>
          </div>
        </aside>
      )}

      {reportOpen && (
        <div className="hm-status-modal-backdrop" role="presentation" onMouseDown={() => setReportOpen(false)}>
          <form
            className="hm-status-modal"
            onSubmit={submitRoadStatusReport}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="hm-status-modal-head">
              <div>
                <span>HOLA MAPS LIVE</span>
                <h2>Báo tình trạng khu vực</h2>
              </div>
              <button type="button" onClick={() => setReportOpen(false)} aria-label="Đóng">
                <X size={18} />
              </button>
            </div>

            {!user ? (
              <div className="hm-status-login">
                <TriangleAlert size={22} />
                <b>Cần đăng nhập để gửi báo cáo</b>
                <p>Đăng nhập giúp hạn chế spam và xây dựng điểm tin cậy cho cộng đồng.</p>
                <Link to="/login" onClick={() => setReportOpen(false)}>Đăng nhập</Link>
              </div>
            ) : (
              <>
                <label>
                  Loại tình trạng
                  <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
                    <option value="REPORT_FLOOD">🌊 Đường / khu vực ngập</option>
                    <option value="REPORT_ROAD_CLOSURE">🚧 Đường cấm / không đi được</option>
                    <option value="REPORT_ALERT">⚠️ Sự cố / cảnh báo khác</option>
                  </select>
                </label>

                <label>
                  Mức độ
                  <select value={reportSeverity} onChange={(event) => setReportSeverity(event.target.value)}>
                    <option value="LOW">Thấp</option>
                    <option value="MEDIUM">Trung bình</option>
                    <option value="HIGH">Cao</option>
                    <option value="CRITICAL">Nghiêm trọng</option>
                  </select>
                </label>

                <label>
                  Mô tả thực tế
                  <textarea
                    rows="3"
                    maxLength="500"
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    placeholder="Ví dụ: nước ngập khoảng 25 cm, xe máy vẫn đi chậm được..."
                  />
                </label>

                <div className="hm-status-location">
                  <div>
                    <span>Vị trí báo cáo</span>
                    <b>
                      {reportLocation
                        ? Number(reportLocation.lat).toFixed(5) + ', ' + Number(reportLocation.lng).toFixed(5)
                        : 'Tâm khu vực đang xem'}
                    </b>
                  </div>
                  <button type="button" onClick={useMyLocationForReport}>
                    <Navigation size={14} /> Dùng vị trí của tôi
                  </button>
                </div>

                <label className="hm-status-photo">
                  Ảnh minh chứng <small>(không bắt buộc)</small>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(event) => setReportPhotos(Array.from(event.target.files || []))}
                  />
                  {!!reportPhotos.length && <span>{reportPhotos.length} ảnh đã chọn</span>}
                </label>

                <p className="hm-status-expiry-note">
                  Báo cáo sẽ tự hết hạn theo loại và mức độ nếu cộng đồng không còn xác nhận.
                </p>

                <button className="hm-status-submit" type="submit" disabled={reportSubmitting}>
                  <TriangleAlert size={16} />
                  {reportSubmitting ? 'Đang gửi...' : 'Gửi báo cáo cộng đồng'}
                </button>
              </>
            )}
          </form>
        </div>
      )}

      {leftOpen && (
        <button
          className={'hm-mobile-panel-backdrop sheet-' + mobileSheetLevel}
          type="button"
          aria-label="Đóng danh sách địa điểm"
          onClick={() => setLeftOpen(false)}
        />
      )}

      <aside
        className={
          (leftOpen ? 'hm-left-panel open ' : 'hm-left-panel ') +
          'sheet-' + mobileSheetLevel
        }
      >
        <button
          type="button"
          className="hm-sheet-drag-handle"
          onPointerDown={startSheetDrag}
          onPointerUp={finishSheetDrag}
          onPointerCancel={() => {
            sheetDragRef.current = null;
            sheetDragMovedRef.current = false;
          }}
          onClick={cycleSheetLevel}
          aria-label={'Thay đổi độ cao danh sách: ' + mobileSheetLevel}
          title="Kéo lên hoặc xuống để đổi độ cao"
        >
          <span />
        </button>
        <div className="hm-panel-heading">
          <div>
            <span>HOLA MAPS ENGINE</span>
            <h1>Bản đồ Hòa Lạc</h1>
          </div>
          <button type="button" onClick={() => setLeftOpen(false)}><X size={17} /></button>
        </div>

        <section className="hm-panel-section hm-place-results">
          <div className="hm-section-title">
            <span>
              {query.trim()
                ? 'KẾT QUẢ TÌM KIẾM'
                : placeScope === 'near-me'
                  ? 'GẦN VỊ TRÍ CỦA BẠN'
                  : placeScope === 'nearby'
                    ? 'ĐỊA ĐIỂM LÂN CẬN'
                    : placeScope === 'all'
                    ? 'TẤT CẢ ĐỊA ĐIỂM'
                    : 'ĐỊA ĐIỂM ĐÃ TẢI'}
            </span>
            <b>{filteredPlaces.length}</b>
          </div>

          {!query.trim() && placeScope === 'viewport' && filteredPlaces.length > 0 && viewportPlaceCount === 0 && (
            <div className="hm-place-scope-bar">
              <span>Vùng đang xem chưa có địa điểm · vẫn giữ {filteredPlaces.length} địa điểm đã tải</span>
              <button type="button" onClick={showNearbyPlaces}>
                Tìm lân cận
              </button>
            </div>
          )}

          {!query.trim() && placeScope !== 'viewport' && (
            <div className="hm-place-scope-bar">
              <span>
                {placeScope === 'near-me'
                  ? 'Quanh vị trí của bạn' + (nearbyRadius ? ' · ' + Math.round(nearbyRadius / 1000) + ' km' : '')
                  : placeScope === 'nearby'
                    ? 'Quanh khu vực đang xem' + (nearbyRadius ? ' · ' + Math.round(nearbyRadius / 1000) + ' km' : '')
                    : 'Toàn bộ dữ liệu Hola Maps'}
              </span>
              <button type="button" onClick={resetToViewportPlaces}>
                Khu vực đang xem
              </button>
            </div>
          )}

          <div className="hm-place-list">
            {sidebarPlaces.slice(0, 80).map((place) => (
              <button
                key={place.id}
                type="button"
                ref={(node) => {
                  const key = String(place.id);
                  if (node) placeRowRefs.current.set(key, node);
                  else placeRowRefs.current.delete(key);
                }}
                className={
                  selectedId === place.id
                    ? 'hm-place-row active'
                    : String(hoveredPlaceId) === String(place.id)
                      ? 'hm-place-row hovered'
                      : 'hm-place-row'
                }
                onMouseEnter={() => setHoveredPlaceId(String(place.id))}
                onMouseLeave={() => setHoveredPlaceId(null)}
                onFocus={() => setHoveredPlaceId(String(place.id))}
                onBlur={() => setHoveredPlaceId(null)}
                onClick={() => togglePlaceSelection(place)}
              >
                <span
                  className={
                    'hm-place-thumb ' +
                    (getPlaceListImage(place) ? 'has-image ' : 'icon-fallback ') +
                    getPlaceCategoryVisual(place).tone
                  }
                >
                  {getPlaceListImage(place) ? (
                    <>
                      <img
                        src={getPlaceListImage(place)}
                        alt={place.name ? 'Ảnh ' + place.name : ''}
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                          event.currentTarget.parentElement?.classList.add('image-error');
                        }}
                      />
                      <span className="hm-place-fallback-icon">
                        <PlaceCategoryIcon place={place} size={25} />
                      </span>
                    </>
                  ) : (
                    <PlaceCategoryIcon place={place} size={25} />
                  )}
                </span>
                <span className="hm-place-copy">
                  <small>{place.category || 'Địa điểm'}</small>
                  <b>{place.name}</b>
                  <em>
                    {Number.isFinite(Number(place.distanceFromUser))
                      ? formatDistance(place.distanceFromUser) + ' · '
                      : placeScope === 'nearby' && Number.isFinite(Number(place.distance))
                        ? formatDistance(place.distance) + ' · '
                        : ''}
                    {place.address || 'Hòa Lạc, Hà Nội'}
                  </em>
                  {place.openingHours && (() => {
                    const status = formatOpenStatus(place.openingHours);
                    return (
                      <span className={status.known ? (status.open ? 'hm-open-status open' : 'hm-open-status closed') : 'hm-open-status unknown'}>
                        {status.label} · {place.openingHours}
                      </span>
                    );
                  })()}
                </span>
                <span className="hm-place-rating">★ {Number(place.rating || 0).toFixed(1)}</span>
              </button>
            ))}

            {!placeScopeLoading && filteredPlaces.length === 0 && !query.trim() && placeScope === 'viewport' && (
              <div className="hm-place-empty">
                <span className="hm-place-empty-icon"><MapPin size={20} /></span>
                <b>Chưa có địa điểm trong vùng này</b>
                <p>Mở rộng phạm vi để tiếp tục khám phá thay vì để danh sách trống.</p>
                <div className="hm-place-empty-actions">
                  <button type="button" onClick={showNearbyPlaces}>
                    <Navigation size={14} />
                    Xem khu vực lân cận
                  </button>
                  <button type="button" onClick={showAllPlaces}>
                    <MapIcon size={14} />
                    Tất cả địa điểm
                  </button>
                </div>
              </div>
            )}

            {!placeScopeLoading && filteredPlaces.length === 0 && !!query.trim() && (
              <div className="hm-place-empty compact">
                <span className="hm-place-empty-icon"><Search size={18} /></span>
                <b>Không tìm thấy “{query.trim()}”</b>
                <p>Thử tên địa điểm, khu vực hoặc từ khóa khác.</p>
                <button className="hm-place-empty-reset" type="button" onClick={() => handleQueryChange('')}>
                  Xóa tìm kiếm
                </button>
              </div>
            )}

            {!placeScopeLoading && filteredPlaces.length === 0 && !query.trim() && placeScope === 'near-me' && (
              <div className="hm-place-empty compact">
                <span className="hm-place-empty-icon"><Navigation size={18} /></span>
                <b>Chưa tìm thấy địa điểm gần bạn</b>
                <p>Thử bỏ bộ lọc “Đang mở” hoặc mở rộng sang tất cả địa điểm.</p>
                <button className="hm-place-empty-reset" type="button" onClick={showAllPlaces}>
                  Xem tất cả địa điểm
                </button>
              </div>
            )}

            {!placeScopeLoading && filteredPlaces.length === 0 && !query.trim() && placeScope === 'nearby' && (
              <div className="hm-place-empty compact">
                <span className="hm-place-empty-icon"><Navigation size={18} /></span>
                <b>Chưa có địa điểm lân cận</b>
                <p>Bạn có thể xem toàn bộ địa điểm đang có trên Hola Maps.</p>
                <button className="hm-place-empty-reset" type="button" onClick={showAllPlaces}>
                  Xem tất cả địa điểm
                </button>
              </div>
            )}

            {!placeScopeLoading && filteredPlaces.length === 0 && !query.trim() && placeScope === 'all' && (
              <div className="hm-place-empty compact">
                <span className="hm-place-empty-icon"><MapPin size={18} /></span>
                <b>Chưa có địa điểm nào</b>
                <p>Hãy là người đầu tiên đóng góp địa điểm cho Hola Maps.</p>
              </div>
            )}

            {placeScopeLoading && (
              <div className="hm-place-scope-loading">
                <span />
                Đang mở rộng phạm vi địa điểm…
              </div>
            )}
          </div>
        </section>

        <section className={layersExpanded ? 'hm-panel-section hm-layer-section expanded' : 'hm-panel-section hm-layer-section collapsed'}>
          <button
            type="button"
            className="hm-layer-section-toggle"
            onClick={() => setLayersExpanded((value) => !value)}
            aria-expanded={layersExpanded}
          >
            <span className="hm-layer-section-copy">
              <b>LỚP DỮ LIỆU</b>
              <small>{activeLayers.length} lớp đang hiển thị</small>
            </span>
            <span className="hm-layer-section-meta">
              <b>{activeLayers.length}/{LAYERS.length}</b>
              <ChevronDown size={16} />
            </span>
          </button>

          {layersExpanded && (
            <div className="hm-layer-grid">
              {LAYERS.map(({ type, label, icon: Icon, tone }) => {
                const active = activeLayers.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    className={active ? 'hm-layer-card active ' + tone : 'hm-layer-card ' + tone}
                    onClick={() => toggleLayer(type)}
                  >
                    <span className="hm-layer-icon"><Icon size={17} /></span>
                    <span>
                      <b>{label}</b>
                      <small>{active ? 'Đang hiển thị' : 'Đang ẩn'}</small>
                    </span>
                    <i />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </aside>

      {selectedPlace && !routeDestination && (
        <section className={selectedImages.length ? 'hm-place-inspector has-gallery' : 'hm-place-inspector'}>
          <button
            className="hm-inspector-close"
            type="button"
            onClick={() => {
              setSelectedId(null);
              syncDiscoveryParams({ place: null });
            }}
          >
            <X size={16} />
          </button>

          {selectedImages.length > 0 && (
            <div className="hm-inspector-gallery">
              <div
                className="hm-inspector-gallery-main"
                onTouchStart={startGallerySwipe}
                onTouchEnd={endGallerySwipe}
              >
                <img
                  src={selectedImages[galleryIndex]}
                  alt={selectedPlace.name + ' · ảnh ' + (galleryIndex + 1)}
                />

                {selectedImages.length > 1 && (
                  <>
                    <button
                      className="hm-gallery-arrow prev"
                      type="button"
                      onClick={showPreviousImage}
                      aria-label="Ảnh trước"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      className="hm-gallery-arrow next"
                      type="button"
                      onClick={showNextImage}
                      aria-label="Ảnh tiếp theo"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <span className="hm-gallery-count">
                      {galleryIndex + 1}/{selectedImages.length}
                    </span>
                  </>
                )}
              </div>

              {selectedImages.length > 1 && (
                <div className="hm-inspector-thumbs">
                  {selectedImages.map((image, index) => (
                    <button
                      key={image}
                      type="button"
                      className={index === galleryIndex ? 'active' : ''}
                      onClick={() => setGalleryIndex(index)}
                      aria-label={'Xem ảnh ' + (index + 1)}
                    >
                      <img src={image} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="hm-inspector-kicker">
            <MapPin size={14} /> {selectedPlace.category || 'ĐỊA ĐIỂM'}
          </div>
          <h2>{selectedPlace.name}</h2>
          <p>{selectedPlace.address || 'Hòa Lạc, Hà Nội'}</p>

          <div className="hm-inspector-stats">
            <span><b>★ {Number(selectedPlace.rating || 0).toFixed(1)}</b><small>Đánh giá</small></span>
            <span><b>{selectedPlace.priceLevel || '—'}</b><small>Mức giá</small></span>
          </div>

          {selectedPlace.openingHours && (() => {
            const status = formatOpenStatus(selectedPlace.openingHours);
            return (
              <div className={status.open ? 'hm-inspector-open open' : status.known ? 'hm-inspector-open closed' : 'hm-inspector-open'}>
                <Clock3 size={14} />
                <b>{status.label}</b>
                <span>{selectedPlace.openingHours}</span>
              </div>
            );
          })()}

          <div className="hm-inspector-actions">
            <button type="button" onClick={() => startDirections(selectedPlace)}>
              <Navigation size={16} /> Chỉ đường
            </button>
            <Link to={'/place/' + selectedPlace.id}>
              Chi tiết
            </Link>
          </div>
        </section>
      )}

      {routeDestination && (
        <aside className="hm-route-panel">
          <div className="hm-route-head">
            <span className="hm-route-icon"><Route size={20} /></span>
            <div>
              <small>HOLA ROUTING</small>
              <h2>{routeDestination.name}</h2>
            </div>
            <button type="button" onClick={clearRoute}><X size={17} /></button>
          </div>

          {routeLoading && <div className="hm-route-state">Đang tính tuyến đường nội bộ…</div>}
          {routeError && <div className="hm-route-error">{routeError}</div>}

          {routeData && !routeLoading && (
            <>
              <div className="hm-route-metrics">
                <span><Navigation size={16} /><b>{formatDistance(routeData.distanceMeters)}</b><small>Khoảng cách</small></span>
                <span><Clock3 size={16} /><b>{formatDuration(routeData.durationSeconds)}</b><small>Dự kiến</small></span>
              </div>

              {!!routeData.hazards?.length && (
                <div className="hm-route-hazards">
                  <div className="hm-route-hazards-head">
                    <TriangleAlert size={15} />
                    <b>{routeData.hazards.length} cảnh báo trên tuyến</b>
                  </div>
                  {routeData.hazards.slice(0, 4).map((hazard) => (
                    <div className={'hm-route-hazard severity-' + String(hazard.severity || 'INFO').toLowerCase()} key={hazard.id}>
                      <span>{hazard.type === 'FLOOD' ? 'Ngập' : hazard.type === 'ROAD_CLOSURE' ? 'Đường cấm' : 'Cảnh báo'}</span>
                      <b>{hazard.name || hazard.description || 'Cần lưu ý'}</b>
                    </div>
                  ))}
                </div>
              )}

              <div className="hm-route-source">
                <span>ENGINE</span>
                <b>{routeData.provider || 'OSRM'}</b>
                <small>Routing riêng của Hola Maps</small>
              </div>

              <div className="hm-route-actions">
                <a href={googleDirectionsUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} /> Mở tiếp bằng Google Maps
                </a>
              </div>
            </>
          )}
        </aside>
      )}

      <div className={
        leftOpen && mobileSheetLevel === 'full'
          ? 'hm-basemap-switcher panel-open'
          : 'hm-basemap-switcher'
      }>
        {BASEMAP_OPTIONS.map((option) => {
          const Icon = option.id === 'satellite'
            ? Satellite
            : option.id === 'terrain'
              ? Mountain
              : option.id === 'hybrid'
                ? Layers
                : MapIcon;

          return (
            <button
              key={option.id}
              type="button"
              className={(basemapMode === option.id ? 'active ' : '') + 'basemap-' + option.id}
              onClick={() => setBasemapMode(option.id)}
              title={option.description}
            >
              <span><Icon size={17} /></span>
              <b>{option.label}</b>
            </button>
          );
        })}
      </div>

      <div className="hm-map-legend">
        <span><i className="flood" /> Ngập</span>
        <span><i className="closure" /> Đường cấm</span>
        <span><i className="alert" /> Cảnh báo</span>
        <span><i className="planning" /> Quy hoạch</span>
      </div>
    </main>
  );
}
