import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, I18nManager, Modal, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConfirmModal from '@/components/ConfirmModal';
import { RequireAuth } from '@/components/RequireAuth';
import { WizardProgress } from '@/components/WizardProgress';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  ImageIcon,
  X,
  Bike,
  Zap,
  Check,
  MapPin,
  ChevronDown,
  Search,
  Bookmark,
} from 'lucide-react-native';

const ISRAELI_CITIES = [
  'תל אביב-יפו', 'חולון', 'רמת גן', 'גבעתיים',
  'אבן יהודה', 'אופקים', 'אור יהודה', 'אור עקיבא', 'אילת', 'אלעד', 'אריאל', 'אשדוד', 'אשקלון',
  'באקה אל-גרבייה', 'באר יעקב', 'באר שבע', 'בית שאן', 'בית שמש', 'ביתר עילית', 'בני ברק', 'בנימינה-גבעת עדה', 'בת ים',
  'גבעת שמואל', 'גני תקווה',
  'דימונה',
  'הוד השרון', 'הרצליה',
  'חדרה', 'חיפה',
  'טבריה', 'טייבה', 'טירה', 'טירת כרמל',
  'יבנה', 'יבניאל', 'יהוד', 'יהוד-מונוסון', 'יוקנעם עילית', 'ירוחם', 'ירושלים',
  'זכרון יעקב',
  'כפר יונה', 'כפר סבא', 'כפר ויתקין', 'כפר קאסם', 'כרמיאל',
  'לוד',
  'מגדל העמק', 'מודיעין עילית', 'מודיעין-מכבים-רעות', 'מעלה אדומים', 'מעלות-תרשיחא', 'מצפה רמון',
  'נהריה', 'נוף הגליל', 'נס ציונה', 'נצרת', 'נשר', 'נתיבות', 'נתניה',
  'סח׳נין',
  'עכו', 'עפולה', 'עראבה', 'ערד',
  'אום אל-פחם',
  'פרדס חנה-כרכור', 'פתח תקווה',
  'צפת',
  'קלנסווה', 'קצרין', 'קריית אונו', 'קריית אתא', 'קריית ביאליק', 'קריית גת', 'קריית ים', 'קריית מוצקין', 'קריית מלאכי', 'קריית שמונה',
  'ראש העין', 'ראשון לציון', 'רהט', 'רחובות', 'רמלה', 'רמת השרון', 'רעננה',
  'שדרות',
];
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { playSystemSound } from '@/lib/system-sounds';

import { useLanguageStore, useRepairRequestStore } from '@/lib/store';
import { useSession } from '@/lib/auth/use-session';
import { api } from '@/lib/api/api';
import { fetchSavedAddresses, createSavedAddress } from '@/lib/saved-addresses-api';
import { SavedAddress } from '@/lib/types';
import { geocodeCustomerAddress } from '@/lib/geocode-address';
import {
  loadRepairCustomerDefaults,
  saveRepairCustomerDefaults,
} from '@/lib/repair-customer-defaults';
import { BikeType, RepairCategory, REPAIR_CATEGORIES, PRICE_RANGES } from '@/lib/types';
import { cn } from '@/lib/cn';
import { gradients } from '@/lib/brand-colors';

const TOTAL_STEPS = 4;
const DRAFT_KEY = 'repair_request_draft';

type RepairDraft = {
  currentStep: number;
  photoUri: string | null;
  bikeType: BikeType | null;
  categories: RepairCategory[];
  problemDescription: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerCity: string;
  customerStreet: string;
  customerHouseNumber: string;
  customerLocationLat: number | null;
  customerLocationLng: number | null;
};

function RepairRequestScreen() {
  const router = useRouter();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);

  const currentStep = useRepairRequestStore((s) => s.currentStep);
  const photoUri = useRepairRequestStore((s) => s.photoUri);
  const bikeType = useRepairRequestStore((s) => s.bikeType);
  const categories = useRepairRequestStore((s) => s.categories);
  const customerName = useRepairRequestStore((s) => s.customerName);
  const customerPhone = useRepairRequestStore((s) => s.customerPhone);
  const customerEmail = useRepairRequestStore((s) => s.customerEmail);
  const customerCity = useRepairRequestStore((s) => s.customerCity);
  const customerStreet = useRepairRequestStore((s) => s.customerStreet);
  const customerHouseNumber = useRepairRequestStore((s) => s.customerHouseNumber);
  const problemDescription = useRepairRequestStore((s) => s.problemDescription);

  const setStep = useRepairRequestStore((s) => s.setStep);
  const setPhotoUri = useRepairRequestStore((s) => s.setPhotoUri);
  const setBikeType = useRepairRequestStore((s) => s.setBikeType);
  const toggleCategory = useRepairRequestStore((s) => s.toggleCategory);
  const setCustomerName = useRepairRequestStore((s) => s.setCustomerName);
  const setCustomerPhone = useRepairRequestStore((s) => s.setCustomerPhone);
  const setCustomerEmail = useRepairRequestStore((s) => s.setCustomerEmail);
  const setCustomerCity = useRepairRequestStore((s) => s.setCustomerCity);
  const setCustomerStreet = useRepairRequestStore((s) => s.setCustomerStreet);
  const setCustomerHouseNumber = useRepairRequestStore((s) => s.setCustomerHouseNumber);
  const setCustomerLocation = useRepairRequestStore((s) => s.setCustomerLocation);
  const setProblemDescription = useRepairRequestStore((s) => s.setProblemDescription);
  const reset = useRepairRequestStore((s) => s.reset);

  const { data: session } = useSession();
  const draftRestored = useRef(false);
  const defaultsLoadedForUser = useRef<string | null>(null);
  const skipStreetResetOnCityChange = useRef(false);
  const [nameError, setNameError] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [cityError, setCityError] = useState(false);
  const [streetError, setStreetError] = useState(false);
  const [houseNumberError, setHouseNumberError] = useState(false);
  const [infoModal, setInfoModal] = useState({ visible: false, title: '', message: '' });

  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const [streetPickerOpen, setStreetPickerOpen] = useState(false);
  const [streetSearch, setStreetSearch] = useState('');
  const [availableStreets, setAvailableStreets] = useState<string[]>([]);
  const [streetsLoading, setStreetsLoading] = useState(false);
  const [geocodingAddress, setGeocodingAddress] = useState(false);
  const [addressResolveError, setAddressResolveError] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [defaultsSavedBanner, setDefaultsSavedBanner] = useState(false);

  const applyCustomerFields = (fields: {
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerCity?: string;
    customerStreet?: string;
    customerHouseNumber?: string;
    customerLocationLat?: number | null;
    customerLocationLng?: number | null;
    problemDescription?: string;
  }) => {
    if (fields.customerName) setCustomerName(fields.customerName);
    if (fields.customerPhone) setCustomerPhone(fields.customerPhone);
    if (fields.customerEmail) setCustomerEmail(fields.customerEmail);
    if (fields.customerCity) {
      skipStreetResetOnCityChange.current = true;
      setCustomerCity(fields.customerCity);
    }
    if (fields.customerStreet) setCustomerStreet(fields.customerStreet);
    if (fields.customerHouseNumber) setCustomerHouseNumber(fields.customerHouseNumber);
    if (fields.problemDescription) setProblemDescription(fields.problemDescription);
    if (fields.customerLocationLat != null && fields.customerLocationLng != null) {
      setCustomerLocation({
        latitude: fields.customerLocationLat,
        longitude: fields.customerLocationLng,
      });
    }
  };

  useEffect(() => {
    fetchSavedAddresses().then(setSavedAddresses).catch(() => {});
  }, []);

  useEffect(() => {
    if (draftRestored.current) return;
    draftRestored.current = true;

    const init = async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw) as RepairDraft;
          if (draft.currentStep) setStep(draft.currentStep);
          if (draft.photoUri !== undefined) setPhotoUri(draft.photoUri);
          if (draft.bikeType) setBikeType(draft.bikeType);
          if (draft.categories?.length) {
            draft.categories.forEach((cat) => {
              if (!useRepairRequestStore.getState().categories.includes(cat)) {
                useRepairRequestStore.getState().toggleCategory(cat);
              }
            });
          }
          applyCustomerFields(draft);
        }
      } catch {
        // ignore corrupt draft
      }
    };

    init();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || defaultsLoadedForUser.current === userId) return;
    defaultsLoadedForUser.current = userId;

    const fillFromSaved = async () => {
      const saved = await loadRepairCustomerDefaults(userId);
      if (saved) {
        applyCustomerFields(saved);
      }

      const state = useRepairRequestStore.getState();
      if (!state.customerName.trim() && session?.user?.name) {
        setCustomerName(session.user.name);
      }
      if (!state.customerEmail.trim() && session?.user?.email) {
        setCustomerEmail(session.user.email);
      }
      try {
        const me = await api.get<{ user: { phone?: string } }>('/api/me');
        if (!useRepairRequestStore.getState().customerPhone.trim() && me.user?.phone) {
          setCustomerPhone(me.user.phone.replace(/\D/g, '').slice(0, 10));
        }
      } catch {
        // non-blocking
      }
    };

    fillFromSaved();
  }, [session?.user?.id]);

  useEffect(() => {
    const draft: RepairDraft = {
      currentStep,
      photoUri,
      bikeType,
      categories,
      problemDescription,
      customerName,
      customerPhone,
      customerEmail,
      customerCity,
      customerStreet,
      customerHouseNumber,
      customerLocationLat: useRepairRequestStore.getState().customerLocationLat,
      customerLocationLng: useRepairRequestStore.getState().customerLocationLng,
    };
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
  }, [
    currentStep,
    photoUri,
    bikeType,
    categories,
    problemDescription,
    customerName,
    customerPhone,
    customerEmail,
    customerCity,
    customerStreet,
    customerHouseNumber,
  ]);

  useEffect(() => {
    if (!customerCity) {
      setAvailableStreets([]);
      return;
    }
    if (skipStreetResetOnCityChange.current) {
      skipStreetResetOnCityChange.current = false;
    } else {
      setCustomerStreet('');
      setSelectedSavedId(null);
      setAddressResolveError('');
    }
    setStreetsLoading(true);
    const fetchStreets = async () => {
      try {
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;
        const url = `${backendUrl}/api/streets?city=${encodeURIComponent(customerCity)}`;
        const res = await fetch(url);
        const data = await res.json() as { streets: string[] };
        setAvailableStreets(data.streets ?? []);
      } catch {
        setAvailableStreets([]);
      } finally {
        setStreetsLoading(false);
      }
    };
    fetchStreets();
  }, [customerCity]);

  const filteredCities = useMemo(() => {
    const query = citySearch.trim();
    if (!query) return ISRAELI_CITIES;
    return ISRAELI_CITIES.filter((c) => c.includes(query));
  }, [citySearch]);

  const filteredStreets = useMemo(() => {
    const query = streetSearch.trim();
    if (!query) return availableStreets;
    return availableStreets.filter((s) => s.includes(query));
  }, [availableStreets, streetSearch]);

  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  const handleBack = () => {
    Haptics.selectionAsync();
    if (currentStep > 1) {
      setStep(currentStep - 1);
    } else {
      reset();
      router.back();
    }
  };

  const resolveAddressLocation = async (): Promise<boolean> => {
    setAddressResolveError('');
    setGeocodingAddress(true);
    try {
      const saved = selectedSavedId
        ? savedAddresses.find((a) => a.id === selectedSavedId)
        : null;
      if (
        saved?.location &&
        saved.city === customerCity &&
        saved.street === customerStreet &&
        saved.houseNumber === customerHouseNumber
      ) {
        setCustomerLocation(saved.location);
        return true;
      }

      const result = await geocodeCustomerAddress({
        city: customerCity,
        street: customerStreet,
        houseNumber: customerHouseNumber,
      });

      if (!result.ok) {
        const message =
          result.reason === 'not_found'
            ? t('addressNotFoundHint')
            : result.reason === 'network'
              ? t('networkError')
              : t('addressServiceUnavailable');
        setAddressResolveError(message);
        setCityError(true);
        setStreetError(true);
        setHouseNumberError(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return false;
      }

      setCustomerLocation(result.location);
      const exists = savedAddresses.some(
        (a) =>
          a.city === customerCity &&
          a.street === customerStreet &&
          a.houseNumber === customerHouseNumber
      );
      if (!exists) {
        try {
          const updated = await createSavedAddress({
            label: savedAddresses.length === 0 ? 'בית' : `כתובת ${savedAddresses.length + 1}`,
            city: customerCity,
            street: customerStreet,
            houseNumber: customerHouseNumber,
            latitude: result.location.latitude,
            longitude: result.location.longitude,
            isDefault: savedAddresses.length === 0,
          });
          setSavedAddresses(updated);
        } catch {
          // non-blocking
        }
      }
      return true;
    } catch {
      setAddressResolveError(t('networkError'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    } finally {
      setGeocodingAddress(false);
    }
  };

  const handleSaveDefaults = async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setInfoModal({
        visible: true,
        title: t('error'),
        message: language === 'he' ? 'יש להתחבר כדי לשמור פרטים' : 'Sign in to save your details',
      });
      return;
    }

    let hasError = false;
    if (!customerName.trim()) {
      setNameError(true);
      hasError = true;
    }
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (!customerPhone.trim() || phoneDigits.length !== 10 || !phoneDigits.startsWith('0')) {
      setPhoneError(true);
      hasError = true;
    }
    if (!customerCity.trim()) {
      setCityError(true);
      hasError = true;
    }
    if (!customerStreet.trim()) {
      setStreetError(true);
      hasError = true;
    }
    if (!customerHouseNumber.trim()) {
      setHouseNumberError(true);
      hasError = true;
    }
    if (customerEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        setEmailError(true);
        hasError = true;
      }
    }
    if (hasError) return;

    setSavingDefaults(true);
    setAddressResolveError('');
    try {
      let lat = useRepairRequestStore.getState().customerLocationLat;
      let lng = useRepairRequestStore.getState().customerLocationLng;

      if (lat == null || lng == null) {
        const geo = await geocodeCustomerAddress({
          city: customerCity,
          street: customerStreet,
          houseNumber: customerHouseNumber,
        });
        if (!geo.ok) {
          setAddressResolveError(
            geo.reason === 'not_found' ? t('addressNotFoundHint') : t('addressServiceUnavailable')
          );
          setCityError(true);
          setStreetError(true);
          setHouseNumberError(true);
          return;
        }
        setCustomerLocation(geo.location);
        lat = geo.location.latitude;
        lng = geo.location.longitude;
      }

      await saveRepairCustomerDefaults(userId, {
        customerName: customerName.trim(),
        customerPhone,
        customerEmail: customerEmail.trim(),
        customerCity,
        customerStreet,
        customerHouseNumber,
        customerLocationLat: lat,
        customerLocationLng: lng,
        problemDescription: problemDescription.trim(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDefaultsSavedBanner(true);
      setTimeout(() => setDefaultsSavedBanner(false), 4000);
    } catch {
      setAddressResolveError(t('networkError'));
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleSkipPhoto = () => {
    Haptics.selectionAsync();
    playSystemSound('click');
    setStep(2);
  };

  const handleNext = async () => {
    if (currentStep === 2 && (!bikeType || categories.length === 0)) {
      playSystemSound('error');
      setInfoModal({ visible: true, title: t('error'), message: t('selectBikeAndCategory') });
      return;
    }

    if (currentStep === 3) {
      let hasError = false;

      if (!customerName.trim()) {
        setNameError(true);
        hasError = true;
      }

      const phoneDigits = customerPhone.replace(/\D/g, '');
      if (!customerPhone.trim() || phoneDigits.length !== 10 || !phoneDigits.startsWith('0')) {
        setPhoneError(true);
        hasError = true;
      }

      if (!customerCity.trim()) {
        setCityError(true);
        hasError = true;
      }

      if (!customerStreet.trim()) {
        setStreetError(true);
        hasError = true;
      }

      if (!customerHouseNumber.trim()) {
        setHouseNumberError(true);
        hasError = true;
      }

      if (customerEmail.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
          setEmailError(true);
          hasError = true;
        }
      }

      if (hasError) {
        playSystemSound('error');
        return;
      }

      const geocoded = await resolveAddressLocation();
      if (!geocoded) return;
    }

    if (currentStep < TOTAL_STEPS) {
      playSystemSound('click');
      setStep(currentStep + 1);
    } else {
      playSystemSound('swoosh');
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      router.push('/technician-select');
    }
  };

  const handleTakePhoto = async () => {
    Haptics.selectionAsync();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setInfoModal({ visible: true, title: t('error'), message: t('permissionDenied') });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleChoosePhoto = async () => {
    Haptics.selectionAsync();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleRemovePhoto = () => {
    Haptics.selectionAsync();
    setPhotoUri(null);
  };

  const getTotalPrice = (): { min: number; max: number } | null => {
    if (!bikeType || categories.length === 0) return null;
    let totalMin = 0;
    let totalMax = 0;
    for (const cat of categories) {
      const range = PRICE_RANGES[cat][bikeType];
      totalMin += range[0];
      totalMax += range[1];
    }
    return { min: totalMin, max: totalMax };
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        return !!bikeType && categories.length > 0;
      case 3:
        return (
          !!customerName.trim() &&
          !!customerPhone.trim() &&
          !!customerCity.trim() &&
          !!customerStreet.trim() &&
          !!customerHouseNumber.trim()
        );
      case 4:
        return true;
      default:
        return false;
    }
  };

  const renderStep1 = () => (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      className="flex-1 px-6"
    >
      <Text className="text-xl font-bold text-gray-900 text-center mb-2">
        {t('uploadPhoto')}
      </Text>
      <Text className="text-gray-500 text-center mb-6">
        {language === 'he'
          ? 'צלם או העלה תמונה של התקלה (אופציונלי) — או דלג והמשך'
          : 'Take or upload a photo (optional) — or skip and continue'}
      </Text>

      {photoUri ? (
        <View className="items-center">
          <View className="relative">
            <Image
              source={{ uri: photoUri }}
              style={{ width: 280, height: 280, borderRadius: 16 }}
            />
            <Pressable
              onPress={handleRemovePhoto}
              className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full items-center justify-center"
            >
              <X size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="gap-4">
          <Pressable
            onPress={handleTakePhoto}
            className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-2xl py-12 items-center"
          >
            <Camera size={48} color="#3B82F6" />
            <Text className="mt-3 text-blue-600 font-semibold text-lg">
              {t('takePhoto')}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleChoosePhoto}
            className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl py-8 items-center"
          >
            <ImageIcon size={32} color="#6B7280" />
            <Text className="mt-2 text-gray-600 font-medium">
              {t('chooseFromGallery')}
            </Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      className="flex-1 px-6"
    >
      <Text className="text-xl font-bold text-gray-900 text-center mb-2">
        {t('bikeDetails')}
      </Text>

      {/* Bike Type Selection */}
      <Text className="text-gray-700 font-semibold mt-4 mb-3">{t('bikeType')}</Text>
      <View className="flex-row gap-3">
        {[
          { key: 'regular' as BikeType, icon: Bike, label: t('regularBike') },
          { key: 'electric' as BikeType, icon: Zap, label: t('electricBike') },
        ].map((type) => {
          const IconComponent = type.icon;
          const isSelected = bikeType === type.key;

          return (
            <Pressable
              key={type.key}
              onPress={() => {
                Haptics.selectionAsync();
                setBikeType(type.key);
              }}
              className={cn(
                'flex-1 py-4 px-3 rounded-2xl border-2 items-center',
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
              )}
            >
              <IconComponent
                size={32}
                color={isSelected ? '#3B82F6' : '#6B7280'}
              />
              <Text
                className={cn(
                  'mt-2 font-semibold',
                  isSelected ? 'text-blue-600' : 'text-gray-600'
                )}
              >
                {type.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Category Multi-Selection */}
      <Text className="text-gray-700 font-semibold mt-6 mb-1">
        {t('repairCategory')}
      </Text>
      <Text className="text-gray-400 text-sm mb-3">
        {language === 'he' ? 'ניתן לבחור מספר אפשרויות' : 'You can select multiple options'}
      </Text>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {REPAIR_CATEGORIES.map((cat) => {
          const isSelected = categories.includes(cat.key);
          const label = t(cat.labelKey as keyof typeof t);

          return (
            <Pressable
              key={cat.key}
              onPress={() => {
                Haptics.selectionAsync();
                toggleCategory(cat.key);
              }}
              className={cn(
                'flex-row items-center py-4 px-4 rounded-xl mb-2 border-2',
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white'
              )}
            >
              <View
                className={cn(
                  'w-6 h-6 rounded-md border-2 items-center justify-center mr-3',
                  isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                )}
              >
                {isSelected && <Check size={14} color="#fff" />}
              </View>
              <Text
                className={cn(
                  'font-medium flex-1',
                  isSelected ? 'text-blue-600' : 'text-gray-700'
                )}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );

  const renderStep4 = () => {
    const priceRange = getTotalPrice();

    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        className="flex-1 px-6"
      >
        <Text className="text-xl font-bold text-gray-900 text-center mb-2">
          {t('priceEstimate')}
        </Text>
        <Text className="text-gray-500 text-center mb-8">
          {language === 'he'
            ? 'לפניך הערכת מחיר לפי סוג התקלה'
            : 'Here is an estimated price based on the issue type'}
        </Text>

        {/* Summary Card */}
        <View className="bg-white rounded-2xl p-6 shadow-lg shadow-black/5 border border-gray-100">
          {/* Photo Preview */}
          {photoUri && (
            <View className="items-center mb-4">
              <Image
                source={{ uri: photoUri }}
                style={{ width: 120, height: 120, borderRadius: 12 }}
              />
            </View>
          )}

          {/* Details */}
          <View className="gap-3">
            <View className="flex-row justify-between">
              <Text className="text-gray-500">{t('bikeType')}</Text>
              <Text className="text-gray-900 font-medium">
                {bikeType === 'electric' ? t('electricBike') : t('regularBike')}
              </Text>
            </View>

            <View>
              <Text className="text-gray-500 mb-2">{t('repairCategory')}</Text>
              {categories.map((cat) => {
                const label = t(REPAIR_CATEGORIES.find((c) => c.key === cat)?.labelKey as keyof typeof t);
                return (
                  <View key={cat} className="flex-row items-center mb-1 gap-2">
                    <View className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <Text className="text-gray-800 font-medium">{label}</Text>
                  </View>
                );
              })}
            </View>

            <View className="h-px bg-gray-100 my-2" />

            {/* Price */}
            <View className="items-center py-4">
              <Text className="text-gray-500 mb-2">{t('estimatedPrice')}</Text>
              {priceRange && (
                <Text className="text-3xl font-bold text-blue-600">
                  {priceRange.min === priceRange.max
                    ? `₪${priceRange.min}`
                    : `₪${priceRange.min} - ₪${priceRange.max}`}
                </Text>
              )}
              {categories.length > 1 && (
                <Text className="text-gray-400 text-xs mt-1">
                  {language === 'he' ? `סה"כ עבור ${categories.length} תיקונים` : `Total for ${categories.length} repairs`}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Note */}
        <View className="mt-4 bg-yellow-50 rounded-xl p-4">
          <Text className="text-yellow-800 text-center text-sm">
            ⚠️ {t('priceNote')}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const renderStep3 = () => (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      className="flex-1 px-6"
    >
      <Text className="text-xl font-bold text-gray-900 text-center mb-2">
        {t('customerDetails')}
      </Text>
      <Text className="text-gray-500 text-center mb-6">
        {t('customerDetailsDesc')}
      </Text>

      <View className="mb-5">
        <Text className="text-gray-700 font-semibold mb-2 text-right">{t('problemDescription')}</Text>
        <View className="bg-gray-50 rounded-xl p-4 border-2 border-transparent">
          <TextInput
            value={problemDescription}
            onChangeText={setProblemDescription}
            placeholder={t('problemDescriptionPlaceholder')}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ textAlign: 'right', minHeight: 80 }}
            className="text-gray-900 text-base"
          />
        </View>
      </View>

      {savedAddresses.length > 0 && (
        <View className="mb-5">
          <Text className="text-gray-700 font-semibold mb-2 text-right">{t('useSavedAddress')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {savedAddresses.map((addr) => (
              <Pressable
                key={addr.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedSavedId(addr.id);
                  if (addr.city) {
                    skipStreetResetOnCityChange.current = true;
                    setCustomerCity(addr.city);
                  }
                  if (addr.street) setCustomerStreet(addr.street);
                  if (addr.houseNumber) setCustomerHouseNumber(addr.houseNumber);
                  if (addr.location) setCustomerLocation(addr.location);
                  setCityError(false);
                  setStreetError(false);
                  setHouseNumberError(false);
                  setAddressResolveError('');
                }}
                className={cn(
                  'px-4 py-3 rounded-xl border',
                  selectedSavedId === addr.id ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-200'
                )}
              >
                <Text className={cn('font-semibold text-sm', selectedSavedId === addr.id ? 'text-blue-600' : 'text-gray-700')}>
                  {addr.label}
                </Text>
                <Text className="text-gray-500 text-xs mt-1" numberOfLines={1}>{addr.address}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Customer Name */}
      <View className="mb-4">
        <View className="flex-row items-center gap-1 mb-2">
          <Text className="text-red-500 font-semibold">*</Text>
          <Text className="text-gray-700 font-semibold">{t('customerName')}</Text>
        </View>
        <View
          className={cn(
            'bg-gray-50 rounded-xl p-4 border-2',
            nameError ? 'border-red-300' : 'border-transparent'
          )}
        >
          <TextInput
            value={customerName}
            onChangeText={(text) => {
              setCustomerName(text);
              if (text.trim()) setNameError(false);
            }}
            placeholder={t('customerNamePlaceholder')}
            placeholderTextColor="#9CA3AF"
            className="text-gray-900 text-base"
          />
        </View>
        {nameError && (
          <Text className="text-red-500 text-sm mt-1 px-2">{t('nameRequired')}</Text>
        )}
      </View>

      {/* Customer Phone */}
      <View className="mb-4">
        <View className="flex-row items-center gap-1 mb-2">
          <Text className="text-red-500 font-semibold">*</Text>
          <Text className="text-gray-700 font-semibold">{t('customerPhone')}</Text>
        </View>
        <View
          className={cn(
            'bg-gray-50 rounded-xl p-4 border-2',
            phoneError ? 'border-red-300' : 'border-transparent'
          )}
        >
          <TextInput
            value={customerPhone}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '').slice(0, 10);
              setCustomerPhone(digits);
              if (digits.length === 10) setPhoneError(false);
            }}
            placeholder={t('customerPhonePlaceholder')}
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            maxLength={10}
            className="text-gray-900 text-base"
          />
        </View>
        {phoneError && (
          <Text className="text-red-500 text-sm mt-1 px-2">{t('phoneRequired')}</Text>
        )}
      </View>

      {/* Customer Address — Israel only */}
      <View className="mb-4">
        <View className="flex-row items-center gap-2 mb-3">
          <MapPin size={16} color="#3B82F6" />
          <Text className="text-gray-800 font-bold text-base">
            כתובת <Text className="text-red-500">*</Text>
          </Text>
          <View className="bg-blue-100 rounded-full px-2 py-0.5">
            <Text className="text-blue-600 text-xs font-semibold">ישראל בלבד</Text>
          </View>
        </View>

        <View className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
          {/* City row */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setCitySearch('');
              setCityPickerOpen(true);
            }}
            className="px-4 py-4"
          >
            <Text className="text-gray-400 text-xs mb-1 text-right">עיר</Text>
            <View className="flex-row items-center justify-between">
              <ChevronDown size={16} color={cityError ? '#EF4444' : '#9CA3AF'} />
              <Text
                className={cn(
                  'text-base font-medium flex-1 text-right mr-1',
                  customerCity ? 'text-gray-900' : 'text-gray-400'
                )}
              >
                {customerCity || 'בחר עיר...'}
              </Text>
            </View>
          </Pressable>
          {cityError && (
            <Text className="text-red-500 text-xs px-4 pb-2 text-right">נא לבחור עיר</Text>
          )}

          <View className="h-px bg-gray-200 mx-4" />

          {/* Street row */}
          <Pressable
            onPress={() => {
              if (!customerCity) {
                setCityError(true);
                return;
              }
              Haptics.selectionAsync();
              setStreetSearch('');
              setStreetPickerOpen(true);
            }}
            className="px-4 py-4"
          >
            <Text className="text-gray-400 text-xs mb-1 text-right">רחוב</Text>
            <View className="flex-row items-center justify-between">
              <ChevronDown size={16} color={streetError ? '#EF4444' : !customerCity ? '#D1D5DB' : '#9CA3AF'} />
              <Text
                className={cn(
                  'text-base font-medium flex-1 text-right mr-1',
                  customerStreet ? 'text-gray-900' : !customerCity ? 'text-gray-300' : 'text-gray-400'
                )}
              >
                {customerStreet || (!customerCity ? 'בחר עיר תחילה' : 'בחר רחוב...')}
              </Text>
            </View>
            {streetError && (
              <Text className="text-red-500 text-xs mt-1 text-right">נא לבחור רחוב</Text>
            )}
          </Pressable>

          <View className="h-px bg-gray-200 mx-4" />

          {/* House number row */}
          <View className="px-4 py-4">
            <Text className="text-gray-400 text-xs mb-1 text-right">מספר בית</Text>
            <TextInput
              value={customerHouseNumber}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9A-Za-z\u0590-\u05FF\s/-]/g, '').slice(0, 8);
                setCustomerHouseNumber(cleaned);
                setSelectedSavedId(null);
                setAddressResolveError('');
                if (cleaned.trim()) setHouseNumberError(false);
              }}
              placeholder="לדוגמה: 12 או 12א"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              style={{ textAlign: 'right' }}
              className={cn('text-gray-900 text-base font-medium', houseNumberError && 'text-red-500')}
            />
            {houseNumberError && (
              <Text className="text-red-500 text-xs mt-1 text-right">נא להזין מספר בית</Text>
            )}
          </View>
        </View>

        {addressResolveError ? (
          <View className="mt-3 mx-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Text className="text-amber-900 text-sm text-right leading-5">{addressResolveError}</Text>
          </View>
        ) : null}
      </View>

      {/* Customer Email (Optional) */}
      <View className="mb-4">
        <Text className="text-gray-700 font-semibold mb-2">
          {t('customerEmail')}
        </Text>
        <View
          className={cn(
            'bg-gray-50 rounded-xl p-4 border-2',
            emailError ? 'border-red-300' : 'border-transparent'
          )}
        >
          <TextInput
            value={customerEmail}
            onChangeText={(text) => {
              setCustomerEmail(text);
              if (!text.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
                setEmailError(false);
              }
            }}
            placeholder={t('customerEmailPlaceholder')}
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            className="text-gray-900 text-base"
          />
        </View>
        {emailError && (
          <Text className="text-red-500 text-sm mt-1 px-2">{t('invalidEmail')}</Text>
        )}
      </View>

    </Animated.View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <Pressable
          onPress={handleBack}
          className="w-10 h-10 items-center justify-center"
        >
          <BackIcon size={24} color="#374151" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">{t('reportIssue')}</Text>
        <View className="w-10" />
      </View>

      <WizardProgress
        current={currentStep}
        total={TOTAL_STEPS}
        label={`${t('step')} ${currentStep} ${t('of')} ${TOTAL_STEPS}`}
      />

      {/* Step Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </ScrollView>

      {/* Bottom Button */}
      <View className="px-6 pb-6 pt-4">
        {currentStep === 1 && (
          <Pressable onPress={handleSkipPhoto} className="mb-3 py-3 items-center">
            <Text className="text-gray-500 font-semibold text-base">{t('skipPhoto')}</Text>
          </Pressable>
        )}
        {currentStep === 3 && defaultsSavedBanner && (
          <View className="mb-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <Text className="text-emerald-800 text-sm text-right leading-5">{t('detailsSavedSuccess')}</Text>
          </View>
        )}
        {currentStep === 3 && (
          <Pressable
            onPress={handleSaveDefaults}
            disabled={savingDefaults || geocodingAddress}
            className={cn(
              'flex-row items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-blue-200 bg-blue-50 mb-3',
              (savingDefaults || geocodingAddress) && 'opacity-50'
            )}
          >
            {savingDefaults ? (
              <Text className="text-blue-700 font-semibold text-base">{language === 'he' ? 'שומר…' : 'Saving…'}</Text>
            ) : (
              <>
                <Bookmark size={18} color="#2563EB" />
                <Text className="text-blue-700 font-semibold text-base">{t('saveDetailsForNextTime')}</Text>
              </>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={handleNext}
          disabled={!canProceed() || geocodingAddress}
          className={cn('rounded-2xl overflow-hidden', (!canProceed() || geocodingAddress) && 'opacity-50')}
        >
          <LinearGradient
            colors={[...gradients.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 16, alignItems: 'center' }}
          >
            <Text className="text-white font-bold text-lg">
              {geocodingAddress
                ? (language === 'he' ? 'מאתר כתובת…' : 'Finding address…')
                : currentStep === TOTAL_STEPS
                  ? t('findTechnician')
                  : t('next')}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Street picker modal */}
      <Modal
        visible={streetPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStreetPickerOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <Pressable
              onPress={() => setStreetPickerOpen(false)}
              className="w-10 h-10 items-center justify-center"
            >
              <X size={22} color="#374151" />
            </Pressable>
            <Text className="text-lg font-bold text-gray-900">בחר רחוב</Text>
            <View className="w-10" />
          </View>

          <View className="px-4 py-3 border-b border-gray-100">
            <View className="bg-gray-100 rounded-xl px-3 py-2 flex-row items-center gap-2">
              <Search size={18} color="#6B7280" />
              <TextInput
                value={streetSearch}
                onChangeText={setStreetSearch}
                placeholder="חפש רחוב..."
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-gray-900 text-base text-right"
                autoFocus
              />
              {streetSearch.length > 0 && (
                <Pressable onPress={() => setStreetSearch('')}>
                  <X size={16} color="#9CA3AF" />
                </Pressable>
              )}
            </View>
          </View>

          {streetsLoading ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-gray-400 text-base">טוען רחובות...</Text>
            </View>
          ) : availableStreets.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6 gap-4">
              <Text className="text-gray-500 text-base text-center font-medium">הזן שם רחוב ידנית</Text>
              <View className="bg-gray-100 rounded-xl px-4 py-3 w-full">
                <TextInput
                  value={streetSearch}
                  onChangeText={setStreetSearch}
                  placeholder="הקלד שם רחוב..."
                  placeholderTextColor="#9CA3AF"
                  className="text-gray-900 text-base text-right"
                  autoFocus
                />
              </View>
              <Pressable
                onPress={() => {
                  if (streetSearch.trim()) {
                    Haptics.selectionAsync();
                    setCustomerStreet(streetSearch.trim());
                    setStreetError(false);
                    setStreetPickerOpen(false);
                  }
                }}
                className={cn('bg-blue-500 rounded-xl px-6 py-3', !streetSearch.trim() && 'opacity-40')}
              >
                <Text className="text-white font-bold text-base">אישור</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={filteredStreets}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                streetSearch.trim() ? (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCustomerStreet(streetSearch.trim());
                      setStreetError(false);
                      setStreetPickerOpen(false);
                    }}
                    className="flex-row items-center justify-end px-5 py-4 border-b border-gray-50"
                  >
                    <Text className="text-blue-600 font-medium text-base">השתמש ב״{streetSearch.trim()}״</Text>
                  </Pressable>
                ) : (
                  <View className="items-center py-12">
                    <Text className="text-gray-400">לא נמצא רחוב תואם</Text>
                  </View>
                )
              }
              renderItem={({ item }) => {
                const isSelected = item === customerStreet;
                return (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCustomerStreet(item);
                      setStreetError(false);
                      setStreetPickerOpen(false);
                    }}
                    className={cn(
                      'flex-row items-center justify-between px-5 py-4 border-b border-gray-50',
                      isSelected && 'bg-blue-50'
                    )}
                  >
                    <Text className={cn('text-base text-right flex-1', isSelected ? 'text-blue-600 font-semibold' : 'text-gray-800')}>
                      {item}
                    </Text>
                    {isSelected && <Check size={18} color="#3B82F6" />}
                  </Pressable>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      <ConfirmModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.message}
        alertOnly
        confirmText={t('close')}
        onConfirm={() => setInfoModal((s) => ({ ...s, visible: false }))}
        onCancel={() => setInfoModal((s) => ({ ...s, visible: false }))}
      />

      {/* City picker modal */}
      <Modal
        visible={cityPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCityPickerOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <Pressable
              onPress={() => setCityPickerOpen(false)}
              className="w-10 h-10 items-center justify-center"
            >
              <X size={22} color="#374151" />
            </Pressable>
            <Text className="text-lg font-bold text-gray-900">בחר עיר</Text>
            <View className="w-10" />
          </View>

          <View className="px-4 py-3 border-b border-gray-100">
            <View className="bg-gray-100 rounded-xl px-3 py-2 flex-row items-center gap-2">
              <Search size={18} color="#6B7280" />
              <TextInput
                value={citySearch}
                onChangeText={setCitySearch}
                placeholder="חפש עיר..."
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-gray-900 text-base text-right"
                autoFocus
              />
              {citySearch.length > 0 && (
                <Pressable onPress={() => setCitySearch('')}>
                  <X size={16} color="#9CA3AF" />
                </Pressable>
              )}
            </View>
          </View>

          <FlatList
            data={filteredCities}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View className="items-center py-12">
                <Text className="text-gray-400">לא נמצאה עיר תואמת</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = item === customerCity;
              return (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCustomerCity(item);
                    setCityError(false);
                    setCityPickerOpen(false);
                  }}
                  className={cn(
                    'flex-row items-center justify-between px-5 py-4 border-b border-gray-50',
                    isSelected && 'bg-blue-50'
                  )}
                >
                  <Text className={cn('text-base text-right flex-1', isSelected ? 'text-blue-600 font-semibold' : 'text-gray-800')}>
                    {item}
                  </Text>
                  {isSelected && <Check size={18} color="#3B82F6" />}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function RepairRequestRoute() {
  return (
    <RequireAuth>
      <RepairRequestScreen />
    </RequireAuth>
  );
}
