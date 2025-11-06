'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Lang = 'is' | 'en';

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: typeof enText | typeof isText;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  // Always start with 'en' to match server-side rendering
  // This prevents hydration mismatches
  const [lang, setLang] = useState<Lang>('en');
  const [mounted, setMounted] = useState(false);

  // Load language from localStorage after component mounts (client-side only)
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('samvera_lang') as Lang | null;
    if (saved === 'is' || saved === 'en') {
      setLang(saved);
    }
  }, []);

  // Save language preference to localStorage when it changes
  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem('samvera_lang', lang);
    }
  }, [lang, mounted]);

  const t = lang === 'is' ? isText : enText;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Translation objects
const enText = {
  // Navbar
  light: "Light",
  dark: "Dark",
  
  // Admin Dashboard
  adminDashboard: "Admin Dashboard",
  manageUsersSchools: "Manage users, schools, and system settings",
  adminAccess: "Admin Access",
  fullPermissions: "Full permissions",
  totalUsers: "Total Users",
  teachers: "Teachers",
  students: "Students",
  parents: "Parents",
  activeUsers: "Active Users",
  newThisWeek: "New This Week",
  quickActions: "Quick Actions",
  addNewUser: "Add New User",
  createNewUserAccount: "Create a new user account",
  manageSchools: "Manage Schools",
  configureSchoolSettings: "Configure school settings",
  systemSettings: "System Settings",
  configureSystemPreferences: "Configure system preferences",
  generateReports: "Generate Reports",
  createUsageAnalyticsReports: "Create usage and analytics reports",
  recentActivity: "Recent Activity",
  viewAll: "View all",
  systemStatus: "System Status",
  database: "Database",
  operational: "Operational",
  api: "API",
  healthy: "Healthy",
  backup: "Backup",
  pending: "Pending",
  registeredAs: "registered as",
  loggedIn: "logged in",
  systemAlertTriggered: "System alert triggered",
  thisMonth: "this month",
  thisWeek: "this week",
} as const;

const isText = {
  // Navbar
  light: "Ljós",
  dark: "Dökkt",
  
  // Admin Dashboard
  adminDashboard: "Stjórnunaryfirlit",
  manageUsersSchools: "Stjórna notendum, skólum og kerfisstillingum",
  adminAccess: "Stjórnunaraðgangur",
  fullPermissions: "Full réttindi",
  totalUsers: "Heildarnotendur",
  teachers: "Kennarar",
  students: "Nemandi",
  parents: "Foreldrar",
  activeUsers: "Virkir notendur",
  newThisWeek: "Nýir þessa viku",
  quickActions: "Fljótlegar aðgerðir",
  addNewUser: "Bæta við nýjum notanda",
  createNewUserAccount: "Búa til nýjan notandaaðgang",
  manageSchools: "Stjórna skólum",
  configureSchoolSettings: "Stilla skólastillingar",
  systemSettings: "Kerfisstillingar",
  configureSystemPreferences: "Stilla kerfisvalkosti",
  generateReports: "Búa til skýrslur",
  createUsageAnalyticsReports: "Búa til notkun og greiningarskýrslur",
  recentActivity: "Nýlegar athafnir",
  viewAll: "Skoða allt",
  systemStatus: "Kerfisstaða",
  database: "Gagnagrunnur",
  operational: "Í rekstri",
  api: "API",
  healthy: "Heilbrigt",
  backup: "Öryggisafrit",
  pending: "Í bið",
  registeredAs: "skráður sem",
  loggedIn: "skráður inn",
  systemAlertTriggered: "Kerfisviðvörun kveikt",
  thisMonth: "þennan mánuð",
  thisWeek: "þessa viku",
} as const;
