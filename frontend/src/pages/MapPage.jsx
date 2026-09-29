import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Construction,
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
  TriangleAlert,
  Waves,
  X
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import MapView from '../components/MapView.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
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
  const { isModerator } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [places, setPlaces] = useState([]);
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(() => searchParams.get('category') || 'all');
  const [minRating, setMinRating] = useState(() => searchParams.get('rating') || '');
  const [openNow, setOpenNow] = useState(() => searchParams.get('open') === '1');
  const [sortMode, setSortMode] = useState(() => searchParams.get('sort') || 'relevant');
  const [selectedId, setSelectedId] = useState(null);
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

  const [routeDestination, setRouteDestination] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  const lastPlacesRequestKeyRef = useRef('');
  const loadedPlaceBoundsRef = useRef([]);
  const lastLayersRequestKeyRef = useRef('');
  const galleryTouchStartRef = useRef(null);

  const regionId = searchParams.get('region') || 'all';
  const requestedPlaceId = searchParams.get('place') || '';
  const focusRegion = REGION_PRESETS.find((item) => item.id === regionId) || REGION_PRESETS[0];

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
            lastPlacesRequestKeyRef.current = requestKey;
            setPlaces(Array.isArray(data?.items) ? data.items : []);
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
  }, [viewport, activeLayers]);

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

  const selectedImages = useMemo(
    () => Array.from(new Set(
      (selectedPlace?.images || []).filter(
        (image) => typeof image === 'string' && image.trim()
      )
    )),
    [selectedPlace]
  );

  useEffect(() => {
    setGalleryIndex(0);
  }, [selectedId]);

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

    setQuery(value);
    syncDiscoveryParams({
      q: value.trim() || null,
      place: wasSearching !== willSearch ? null : requestedPlaceId || null
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
        onSelectPlace={togglePlaceSelection}
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
          onClick={() => setLeftOpen((value) => !value)}
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
            {placeScope === 'near-me' ? 'Đang gần tôi' : 'Gần tôi'}
          </button>

          <button
            type="button"
            className={openNow ? 'hm-quick-filter active' : 'hm-quick-filter'}
            onClick={handleOpenNowToggle}
          >
            <Clock3 size={14} />
            Đang mở
          </button>

          <select
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value)}
            aria-label="Lọc theo danh mục"
          >
            <option value="all">Tất cả danh mục</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>{item.name}</option>
            ))}
          </select>

          <select
            value={minRating}
            onChange={(event) => handleRatingChange(event.target.value)}
            aria-label="Lọc theo đánh giá"
          >
            <option value="">Mọi đánh giá</option>
            <option value="4">★ 4.0+</option>
            <option value="4.5">★ 4.5+</option>
          </select>

          <select
            value={sortMode}
            onChange={(event) => handleSortChange(event.target.value)}
            aria-label="Sắp xếp địa điểm"
          >
            <option value="relevant">Phù hợp</option>
            <option value="nearest" disabled={!userLocation}>Gần nhất</option>
            <option value="rating">Đánh giá cao</option>
            <option value="recent">Mới cập nhật</option>
          </select>
        </div>

        <div className="hm-topbar-status">
          <span className="hm-live-dot" />
          <b>LOCAL DATA</b>
          <span>{dataLoading ? 'Đang đồng bộ…' : mapData.features.length + ' đối tượng'}</span>
        </div>

        {isModerator && (
          <Link className="hm-map-edit-link" to="/admin/map-editor">
            <MapIcon size={16} /> Biên tập
          </Link>
        )}

        <Link className="hm-add-place" to="/contribute">
          <Plus size={17} /> Thêm địa điểm
        </Link>
      </header>

      {leftOpen && (
        <button
          className="hm-mobile-panel-backdrop"
          type="button"
          aria-label="Đóng danh sách địa điểm"
          onClick={() => setLeftOpen(false)}
        />
      )}

      <aside className={leftOpen ? 'hm-left-panel open' : 'hm-left-panel'}>
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
                className={selectedId === place.id ? 'hm-place-row active' : 'hm-place-row'}
                onClick={() => togglePlaceSelection(place)}
              >
                <span className="hm-place-thumb">
                  {place.images?.[0]
                    ? <img src={place.images[0]} alt="" />
                    : <MapPin size={17} />}
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

      <div className={leftOpen ? 'hm-basemap-switcher panel-open' : 'hm-basemap-switcher'}>
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
