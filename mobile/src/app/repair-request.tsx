import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  I18nManager,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConfirmModal from '@/components/ConfirmModal';
import { RequireAuth } from '@/components/RequireAuth';
import { WizardProgress } from '@/components/WizardProgress';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhoneColumn } from '@/components/PhoneColumn';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
      <Text style={rrStyles.stepTitle}>{t('uploadPhoto')}</Text>
      <Text style={rrStyles.stepSub}>
        {language === 'he'
          ? 'צלם או העלה תמונה של התקלה (אופציונלי) — או דלג והמשך'
          : 'Take or upload a photo (optional) — or skip and continue'}
      </Text>

      {photoUri ? (
        <View className="items-center">
          <View className="relative">
            <Image
              source={{ uri: photoUri }}
              style={{ width: 280, height: 280, borderRadius: 20 }}
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
          <Pressable onPress={handleTakePhoto} style={rrStyles.glassAction}>
            {Platform.OS === 'ios' && (
              <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
            )}
            <View style={[StyleSheet.absoluteFill, rrStyles.glassActionWash]} />
            <Camera size={44} color="#2563EB" />
            <Text style={rrStyles.glassActionLabel}>{t('takePhoto')}</Text>
          </Pressable>

          <Pressable onPress={handleChoosePhoto} style={[rrStyles.glassAction, rrStyles.glassActionSecondary]}>
            {Platform.OS === 'ios' && (
              <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFill} />
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.4)' }]} />
            <ImageIcon size={32} color="#3B82F6" />
            <Text style={[rrStyles.glassActionLabel, { fontSize: 16, marginTop: 8 }]}>
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
      <Text style={rrStyles.stepTitle}>{t('bikeDetails')}</Text>

      <Text style={rrStyles.sectionLabel}>{t('bikeType')}</Text>
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
              style={[rrStyles.glassChip, isSelected && rrStyles.glassChipSelected]}
            >
              <IconComponent size={32} color={isSelected ? '#1D4ED8' : '#64748B'} />
              <Text
                style={[
                  rrStyles.glassChipText,
                  isSelected && rrStyles.glassChipTextSelected,
                ]}
              >
                {type.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[rrStyles.sectionLabel, { marginTop: 22 }]}>{t('repairCategory')}</Text>
      <Text style={rrStyles.sectionHint}>
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
              style={[rrStyles.glassRow, isSelected && rrStyles.glassRowSelected]}
            >
              <View
                style={[
                  rrStyles.checkBox,
                  isSelected && rrStyles.checkBoxSelected,
                ]}
              >
                {isSelected && <Check size={14} color="#fff" />}
              </View>
              <Text
                style={[
                  rrStyles.glassRowText,
                  isSelected && rrStyles.glassRowTextSelected,
                ]}
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
        <Text style={rrStyles.stepTitle}>{t('priceEstimate')}</Text>
        <Text style={[rrStyles.stepSub, { marginBottom: 24 }]}>
          {language === 'he'
            ? 'לפניך הערכת מחיר לפי סוג התקלה'
            : 'Here is an estimated price based on the issue type'}
        </Text>

        {/* Summary Card */}
        <View style={rrStyles.glassCard}>
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
      <Text style={rrStyles.stepTitle}>{t('customerDetails')}</Text>
      <Text style={rrStyles.stepSub}>{t('customerDetailsDesc')}</Text>

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
    <SafeAreaView style={rrStyles.screen} edges={['top', 'bottom']}>
      <PhoneColumn>
      {/* Glass header — home-screen language */}
      <View style={rrStyles.headerWrap}>
        <View style={rrStyles.headerCard}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(239,246,255,0.9)' }]} />
          )}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(191,219,254,0.28)' }]} />
          <View style={rrStyles.headerInner}>
            <Pressable onPress={handleBack} style={rrStyles.backBtn} hitSlop={8}>
              <BackIcon size={22} color="#1E40AF" />
            </Pressable>
            <View style={rrStyles.titleBlock}>
              <Text style={rrStyles.pageKicker}>
                {language === 'he' ? 'הזמנת שירות' : 'Service request'}
              </Text>
              <Text style={rrStyles.pageTitle}>{t('reportIssue')}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          <View style={rrStyles.headerBorder} pointerEvents="none" />
        </View>
      </View>

      <WizardProgress current={currentStep} total={TOTAL_STEPS} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </ScrollView>

      {/* Bottom glass actions */}
      <View style={rrStyles.footer}>
        {currentStep === 1 && (
          <Pressable onPress={handleSkipPhoto} style={rrStyles.skipBtn}>
            <Text style={rrStyles.skipText}>{t('skipPhoto')}</Text>
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
            style={[
              rrStyles.secondaryCta,
              (savingDefaults || geocodingAddress) && { opacity: 0.5 },
            ]}
          >
            {savingDefaults ? (
              <Text style={rrStyles.secondaryCtaText}>
                {language === 'he' ? 'שומר…' : 'Saving…'}
              </Text>
            ) : (
              <>
                <Bookmark size={18} color="#1D4ED8" />
                <Text style={rrStyles.secondaryCtaText}>{t('saveDetailsForNextTime')}</Text>
              </>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={handleNext}
          disabled={!canProceed() || geocodingAddress}
          style={[
            rrStyles.primaryCta,
            (!canProceed() || geocodingAddress) && { opacity: 0.48 },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(59,130,246,0.35)' }]} />
          )}
          <LinearGradient
            colors={[
              'rgba(96,165,250,0.9)',
              'rgba(37,99,235,0.95)',
              'rgba(29,78,216,0.98)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.45)', 'transparent']}
            style={rrStyles.primarySheen}
          />
          <Text style={rrStyles.primaryCtaText}>
            {geocodingAddress
              ? language === 'he'
                ? 'מאתר כתובת…'
                : 'Finding address…'
              : currentStep === TOTAL_STEPS
                ? t('findTechnician')
                : t('next')}
          </Text>
          <View style={rrStyles.primaryBorder} pointerEvents="none" />
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
    </PhoneColumn>
    </SafeAreaView>
  );
}

const rrStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EBF4FF',
  },
  headerWrap: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
  },
  headerCard: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.5)',
  },
  titleBlock: {
    alignItems: 'center',
    flex: 1,
  },
  pageKicker: {
    color: 'rgba(37,99,235,0.7)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pageTitle: {
    color: '#1E3A8A',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.5)',
  },
  stepTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  stepSub: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  sectionLabel: {
    color: '#1E40AF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 10,
  },
  sectionHint: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 12,
  },
  glassAction: {
    borderRadius: 22,
    overflow: 'hidden',
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(219,234,254,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(147,197,253,0.55)',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  glassActionSecondary: {
    paddingVertical: 28,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  glassActionWash: {
    backgroundColor: 'rgba(147,197,253,0.22)',
  },
  glassActionLabel: {
    marginTop: 12,
    color: '#1D4ED8',
    fontSize: 18,
    fontWeight: '700',
  },
  glassChip: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(203,213,225,0.8)',
  },
  glassChipSelected: {
    backgroundColor: 'rgba(191,219,254,0.65)',
    borderColor: 'rgba(59,130,246,0.75)',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  glassChipText: {
    marginTop: 8,
    fontWeight: '700',
    color: '#64748B',
    fontSize: 14,
  },
  glassChipTextSelected: {
    color: '#1D4ED8',
  },
  glassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(226,232,240,0.95)',
  },
  glassRowSelected: {
    backgroundColor: 'rgba(219,234,254,0.75)',
    borderColor: 'rgba(59,130,246,0.7)',
  },
  glassRowText: {
    flex: 1,
    fontWeight: '600',
    color: '#334155',
    fontSize: 15,
  },
  glassRowTextSelected: {
    color: '#1D4ED8',
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  checkBoxSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#3B82F6',
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.4)',
    shadowColor: '#2563EB',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'rgba(235,244,255,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(147,197,253,0.25)',
  },
  skipBtn: {
    alignSelf: 'center',
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  skipText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(147,197,253,0.55)',
  },
  secondaryCtaText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 15,
  },
  primaryCta: {
    borderRadius: 24,
    overflow: 'hidden',
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  primarySheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(15,23,42,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  primaryBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(191,219,254,0.7)',
  },
});

export default function RepairRequestRoute() {
  return (
    <RequireAuth>
      <RepairRequestScreen />
    </RequireAuth>
  );
}
