import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  CustomerProfile,
  TechnicianProfile,
  UserRole,
  Job,
  RepairRequest,
  Location,
  BikeType,
  RepairCategory,
} from './types';
import { Language, translations, TranslationKey } from './i18n';

// Language store
interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'he',
      setLanguage: (lang) => set({ language: lang }),
      t: (key) => {
        const lang = get().language;
        return translations[lang][key] ?? key;
      },
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Auth store
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;

  setUser: (user: User | null) => void;
  setRole: (role: UserRole) => void;
  signIn: (provider: 'google' | 'apple') => Promise<void>;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      role: null,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          role: user?.role ?? null,
        }),

      setRole: (role) =>
        set((state) => ({
          role,
          user: state.user ? { ...state.user, role } : null,
        })),

      signIn: async (_provider) => {
        set({ isLoading: false });
      },

      signOut: () =>
        set({
          user: null,
          isAuthenticated: false,
          role: null,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        role: state.role,
      }),
    }
  )
);

// Customer location store
interface LocationState {
  currentLocation: Location | null;
  locationPermission: 'granted' | 'denied' | 'undetermined';
  isTracking: boolean;

  setCurrentLocation: (location: Location | null) => void;
  setLocationPermission: (permission: 'granted' | 'denied' | 'undetermined') => void;
  setIsTracking: (tracking: boolean) => void;
}

export const useLocationStore = create<LocationState>()((set) => ({
  currentLocation: null,
  locationPermission: 'undetermined',
  isTracking: false,

  setCurrentLocation: (location) => set({ currentLocation: location }),
  setLocationPermission: (permission) => set({ locationPermission: permission }),
  setIsTracking: (tracking) => set({ isTracking: tracking }),
}));

// Repair request store
interface RepairRequestState {
  currentStep: number;
  photoUri: string | null;
  bikeType: BikeType | null;
  categories: RepairCategory[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerCity: string;
  customerStreet: string;
  customerHouseNumber: string;

  setStep: (step: number) => void;
  setPhotoUri: (uri: string | null) => void;
  setBikeType: (type: BikeType) => void;
  toggleCategory: (cat: RepairCategory) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setCustomerEmail: (email: string) => void;
  setCustomerAddress: (address: string) => void;
  setCustomerCity: (city: string) => void;
  setCustomerStreet: (street: string) => void;
  setCustomerHouseNumber: (houseNumber: string) => void;
  reset: () => void;
  getRequest: () => RepairRequest | null;
}

export const useRepairRequestStore = create<RepairRequestState>()((set, get) => ({
  currentStep: 1,
  photoUri: null,
  bikeType: null,
  categories: [],
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  customerAddress: '',
  customerCity: '',
  customerStreet: '',
  customerHouseNumber: '',

  setStep: (step) => set({ currentStep: step }),
  setPhotoUri: (uri) => set({ photoUri: uri }),
  setBikeType: (type) => set({ bikeType: type }),
  toggleCategory: (cat) =>
    set((state) => ({
      categories: state.categories.includes(cat)
        ? state.categories.filter((c) => c !== cat)
        : [...state.categories, cat],
    })),
  setCustomerName: (name) => set({ customerName: name }),
  setCustomerPhone: (phone) => set({ customerPhone: phone }),
  setCustomerEmail: (email) => set({ customerEmail: email }),
  setCustomerAddress: (address) => set({ customerAddress: address }),
  setCustomerCity: (city) => {
    set((state) => {
      const parts = [state.customerStreet, city].filter((p) => p.trim());
      const combined = state.customerHouseNumber.trim()
        ? `${state.customerStreet} ${state.customerHouseNumber}, ${city}`.trim()
        : parts.join(', ');
      return { customerCity: city, customerAddress: combined };
    });
  },
  setCustomerStreet: (street) => {
    set((state) => {
      const combined = state.customerHouseNumber.trim()
        ? `${street} ${state.customerHouseNumber}, ${state.customerCity}`.trim()
        : [street, state.customerCity].filter((p) => p.trim()).join(', ');
      return { customerStreet: street, customerAddress: combined };
    });
  },
  setCustomerHouseNumber: (houseNumber) => {
    set((state) => {
      const combined = houseNumber.trim()
        ? `${state.customerStreet} ${houseNumber}, ${state.customerCity}`.trim()
        : [state.customerStreet, state.customerCity].filter((p) => p.trim()).join(', ');
      return { customerHouseNumber: houseNumber, customerAddress: combined };
    });
  },

  reset: () =>
    set({
      currentStep: 1,
      photoUri: null,
      bikeType: null,
      categories: [],
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      customerAddress: '',
      customerCity: '',
      customerStreet: '',
      customerHouseNumber: '',
    }),

  getRequest: () => {
    const state = get();
    if (!state.bikeType || state.categories.length === 0) {
      return null;
    }

    const { PRICE_RANGES } = require('./types');
    let totalMin = 0;
    let totalMax = 0;
    for (const cat of state.categories) {
      const priceRange = PRICE_RANGES[cat][state.bikeType];
      totalMin += priceRange[0];
      totalMax += priceRange[1];
    }

    return {
      photo_uri: state.photoUri,
      description: state.categories.map((c) => {
        const translations: Record<string, string> = {
          'front_tire_puncture': 'פנצ\'ר בגלגל קדמי',
          'rear_tire_puncture': 'פנצ\'ר בגלגל אחורי',
          'tire_tube_replacement': 'החלפת צמיג+פנימית',
          'brake_issue': 'ברקסים לא עובדים',
          'starts_no_drive': 'נדלק ולא נוסע',
          'general_electrical': 'תקלת חשמל כללית',
          'general_service': 'טיפול כללי',
        };
        return translations[c] ?? c;
      }).join(', '),
      bike_type: state.bikeType,
      categories: state.categories,
      estimated_price_min: totalMin,
      estimated_price_max: totalMax,
    };
  },
}));

// Active job store (for both customer and technician)
interface ActiveJobState {
  activeJob: Job | null;
  technicianLocation: Location | null;

  setActiveJob: (job: Job | null) => void;
  updateJobStatus: (status: Job['status']) => void;
  updateJobTimestamps: (timestamps: Partial<Pick<Job, 'accepted_at' | 'on_way_at' | 'arrived_at' | 'in_progress_at' | 'completed_at'>>) => void;
  updateJobFinalPrice: (finalPrice: number) => void;
  setTechnicianLocation: (location: Location | null) => void;
}

export const useActiveJobStore = create<ActiveJobState>()((set) => ({
  activeJob: null,
  technicianLocation: null,

  setActiveJob: (job) => set({ activeJob: job }),

  updateJobStatus: (status) =>
    set((state) => ({
      activeJob: state.activeJob ? { ...state.activeJob, status } : null,
    })),

  updateJobTimestamps: (timestamps) =>
    set((state) => ({
      activeJob: state.activeJob ? { ...state.activeJob, ...timestamps } : null,
    })),

  updateJobFinalPrice: (finalPrice) =>
    set((state) => ({
      activeJob: state.activeJob ? { ...state.activeJob, final_price: finalPrice } : null,
    })),

  setTechnicianLocation: (location) => set({ technicianLocation: location }),
}));

// Technician availability store
interface TechnicianState {
  isAvailable: boolean;
  profile: TechnicianProfile | null;
  incomingRequest: Job | null;
  activeJobs: Job[];

  setIsAvailable: (available: boolean) => void;
  setProfile: (profile: TechnicianProfile | null) => void;
  setIncomingRequest: (request: Job | null) => void;
  addActiveJob: (job: Job) => void;
  removeActiveJob: (jobId: string) => void;
  updateActiveJob: (jobId: string, updates: Partial<Job>) => void;
}

export const useTechnicianStore = create<TechnicianState>()(
  persist(
    (set) => ({
      isAvailable: false,
      profile: null,
      incomingRequest: null,
      activeJobs: [],

      setIsAvailable: (available) => set({ isAvailable: available }),
      setProfile: (profile) => set({ profile }),
      setIncomingRequest: (request) => set({ incomingRequest: request }),

      addActiveJob: (job) =>
        set((state) => ({
          activeJobs: [...state.activeJobs, job],
        })),

      removeActiveJob: (jobId) =>
        set((state) => ({
          activeJobs: state.activeJobs.filter((j) => j.id !== jobId),
        })),

      updateActiveJob: (jobId, updates) =>
        set((state) => ({
          activeJobs: state.activeJobs.map((j) =>
            j.id === jobId ? { ...j, ...updates } : j
          ),
        })),
    }),
    {
      name: 'technician-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isAvailable: state.isAvailable,
      }),
    }
  )
);

// Orders/Jobs history store
interface OrdersState {
  orders: Job[];
  setOrders: (orders: Job[]) => void;
  addOrder: (order: Job) => void;
}

export const useOrdersStore = create<OrdersState>()((set) => ({
  orders: [],
  setOrders: (orders) => set({ orders }),
  addOrder: (order) =>
    set((state) => ({
      orders: [order, ...state.orders],
    })),
}));

// Notification store
interface NotificationState {
  hasUnread: boolean;
  setHasUnread: (hasUnread: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  hasUnread: false,
  setHasUnread: (hasUnread) => set({ hasUnread }),
}));
