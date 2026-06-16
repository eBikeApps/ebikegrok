import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, I18nManager, Modal, FlatList } from 'react-native';
import ConfirmModal from '@/components/ConfirmModal';
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
import { BikeType, RepairCategory, REPAIR_CATEGORIES, PRICE_RANGES } from '@/lib/types';
import { cn } from '@/lib/cn';

const TOTAL_STEPS = 4;

export default function RepairRequestScreen() {
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
  const reset = useRepairRequestStore((s) => s.reset);

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

  useEffect(() => {
    if (!customerCity) {
      setAvailableStreets([]);
      return;
    }
    setCustomerStreet('');
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

  const handleNext = () => {
    if (currentStep === 1 && !photoUri) {
      playSystemSound('error');
      setInfoModal({ visible: true, title: t('error'), message: t('photoRequired') });
      return;
    }

    if (currentStep === 2 && (!bikeType || categories.length === 0)) {
      playSystemSound('error');
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
    }

    if (currentStep < TOTAL_STEPS) {
      playSystemSound('click');
      setStep(currentStep + 1);
    } else {
      playSystemSound('swoosh');
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
        return !!photoUri;
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

  const renderStepIndicator = () => (
    <View className="flex-row items-center justify-center py-4 gap-2">
      {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
        <View
          key={index}
          className={cn(
            'h-2 rounded-full transition-all',
            index < currentStep ? 'bg-blue-500 w-8' : 'bg-gray-200 w-2'
          )}
        />
      ))}
    </View>
  );

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
          ? 'צלם או העלה תמונה של התקלה כדי שהטכנאי יוכל להתכונן'
          : 'Take or upload a photo of the issue so the technician can prepare'}
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

      {/* Step Indicator */}
      {renderStepIndicator()}

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
        <Pressable
          onPress={handleNext}
          disabled={!canProceed()}
          className={cn('rounded-2xl overflow-hidden', !canProceed() && 'opacity-50')}
        >
          <LinearGradient
            colors={['#3B82F6', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 16, alignItems: 'center' }}
          >
            <Text className="text-white font-bold text-lg">
              {currentStep === TOTAL_STEPS ? t('findTechnician') : t('next')}
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
        confirmText={t('close')}
        cancelText={t('close')}
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
