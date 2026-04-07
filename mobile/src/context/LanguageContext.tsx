import React, { createContext, useContext, useState, useEffect } from 'react';
import { AsyncStorage } from 'react-native';

type Language = 'en' | 'ne';

interface Translations {
  [key: string]: { en: string; ne: string };
}

const translations: Translations = {
  // Common
  'app.name': { en: 'BioBridge Pro HR', ne: 'बायोब्रिज प्रो HR' },
  'common.loading': { en: 'Loading...', ne: 'लोड हुँदैछ...' },
  'common.error': { en: 'Error', ne: 'त्रुटि' },
  'common.success': { en: 'Success', ne: 'सफल' },
  'common.cancel': { en: 'Cancel', ne: 'रद्द गर्नुहोस्' },
  'common.save': { en: 'Save', ne: 'सेभ गर्नुहोस्' },
  'common.delete': { en: 'Delete', ne: 'मेट्नुहोस्' },
  'common.edit': { en: 'Edit', ne: 'सम्पादन' },
  'common.search': { en: 'Search...', ne: 'खोज्नुहोस्...' },
  'common.noData': { en: 'No data available', ne: 'कुनै डाटा उपलब्ध छैन' },
  'common.refresh': { en: 'Refresh', ne: 'रिफ्रेस गर्नुहोस्' },
  
  // Auth
  'auth.login': { en: 'Login', ne: 'लगइन' },
  'auth.logout': { en: 'Logout', ne: 'लगआउट' },
  'auth.username': { en: 'Username', ne: 'प्रयोगकर्ता नाम' },
  'auth.password': { en: 'Password', ne: 'पासवर्ड' },
  'auth.loginTitle': { en: 'Welcome Back', ne: 'स्वागत छ' },
  'auth.loginSubtitle': { en: 'Sign in to continue', ne: 'जारी राख्न साइन इन गर्नुहोस्' },
  'auth.invalidCredentials': { en: 'Invalid credentials', ne: 'अमान्य प्रमाणपत्र' },
  
  // Navigation
  'nav.dashboard': { en: 'Dashboard', ne: 'ड्यासबोर्ड' },
  'nav.attendance': { en: 'Attendance', ne: 'उपस्थिति' },
  'nav.leaves': { en: 'Leaves', ne: 'बिदा' },
  'nav.reports': { en: 'Reports', ne: 'प्रतिवेदन' },
  'nav.settings': { en: 'Settings', ne: 'सेटिङ्स' },
  'nav.profile': { en: 'Profile', ne: 'प्रोफाइल' },
  
  // Dashboard
  'dash.title': { en: 'Dashboard Overview', ne: 'ड्यासबोर्ड अवलोकन' },
  'dash.totalEmployees': { en: 'Total Employees', ne: 'जम्मा कर्मचारी' },
  'dash.presentToday': { en: 'Present Today', ne: 'आज उपस्थित' },
  'dash.lateToday': { en: 'Late Today', ne: 'आज ढिला' },
  'dash.absent': { en: 'Absent', ne: 'अनुपस्थित' },
  'dash.onLeave': { en: 'On Leave', ne: 'बिदामा' },
  'dash.lastSync': { en: 'Last Sync', ne: 'अन्तिम सिङ्क' },
  'dash.syncNow': { en: 'Sync Now', ne: 'अहिले सिङ्क गर्नुहोस्' },
  
  // Attendance
  'att.title': { en: 'Attendance', ne: 'उपस्थिति' },
  'att.checkIn': { en: 'Check In', ne: 'चेक इन' },
  'att.checkOut': { en: 'Check Out', ne: 'चेक आउट' },
  'att.myAttendance': { en: 'My Attendance', ne: 'मेरो उपस्थिति' },
  'att.todayStatus': { en: "Today's Status", ne: 'आजको स्थिति' },
  'att.present': { en: 'Present', ne: 'उपस्थित' },
  'att.absent': { en: 'Absent', ne: 'अनुपस्थित' },
  'att.late': { en: 'Late', ne: 'ढिला' },
  'att.history': { en: 'History', ne: 'इतिहास' },
  
  // Leave
  'leave.title': { en: 'Leave Management', ne: 'बिदा व्यवस्थापन' },
  'leave.apply': { en: 'Apply Leave', ne: 'बिदा निवेदन' },
  'leave.myLeaves': { en: 'My Leaves', ne: 'मेरा बिदाहरू' },
  'leave.pending': { en: 'Pending', ne: 'विचाराधीन' },
  'leave.approved': { en: 'Approved', ne: 'स्वीकृत' },
  'leave.rejected': { en: 'Rejected', ne: 'अस्वीकृत' },
  'leave.startDate': { en: 'Start Date', ne: 'सुरु मिति' },
  'leave.endDate': { en: 'End Date', ne: 'अन्त्य मिति' },
  'leave.reason': { en: 'Reason', ne: 'कारण' },
  'leave.submit': { en: 'Submit Request', ne: 'निवेदन पेश गर्नुहोस्' },
  'leave.sick': { en: 'Sick Leave', ne: 'बिरामी बिदा' },
  'leave.casual': { en: 'Casual Leave', ne: 'साधारण बिदा' },
  'leave.paid': { en: 'Paid Leave', ne: 'तलबी बिदा' },
  
  // Settings
  'settings.title': { en: 'Settings', ne: 'सेटिङ्स' },
  'settings.language': { en: 'Language', ne: 'भाषा' },
  'settings.nepali': { en: 'Nepali (नेपाली)', ne: 'नेपाली' },
  'settings.english': { en: 'English', ne: 'अंग्रेजी' },
  'settings.calendar': { en: 'Calendar Mode', ne: 'क्यालेन्डर मोड' },
  'settings.bs': { en: 'BS (Bikram Sambat)', ne: 'BS (विक्रम सम्बत)' },
  'settings.ad': { en: 'AD (Gregorian)', ne: 'AD (ग्रेगोरियन)' },
  'settings.about': { en: 'About', ne: 'बारेमा' },
  'settings.version': { en: 'Version', ne: 'संस्करण' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      // Simulated - use expo-secure-store in production
      const saved = 'en'; // await AsyncStorage.getItem('language');
      if (saved === 'en' || saved === 'ne') {
        setLanguageState(saved);
      }
    } catch (e) {
      console.error('Failed to load language:', e);
    }
    setLoaded(true);
  };

  const setLanguage = async (lang: Language) => {
    try {
      // await AsyncStorage.setItem('language', lang);
      setLanguageState(lang);
    } catch (e) {
      console.error('Failed to save language:', e);
    }
  };

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) return key;
    return translation[language] || translation.en;
  };

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
