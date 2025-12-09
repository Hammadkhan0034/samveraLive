'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { Users, School, ChartBar as BarChart3, Utensils, AlertCircle, LayoutDashboard, MessageSquare, Camera, CalendarDays, Shield, Link as LinkIcon, Megaphone, Activity, Building, Edit3, Settings, Download, Baby, Maximize2, Minimize2, UsersRound, GraduationCap, Layers, Image as ImageIcon } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import KPICardSkeleton from '@/app/components/loading-skeletons/KPICardSkeleton';
import type { KPICard } from '@/lib/types/dashboard';
import { useAuth } from '@/lib/hooks/useAuth';
import UserCard from '@/app/components/UserCard';
import StoryColumn from '@/app/components/shared/StoryColumn';
import type { Organization } from '@/lib/types/orgs';

interface PrincipalDashboardContentProps {
  t: any;
  kpis: KPICard[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  schoolData?: {
    name: string;
    address?: string;
    kennitala?: string;
    type?: string;
    enrolledCount: number;
    maxCapacity: number;
    totalFloorArea?: number;
    playArea?: number;
    guardiansCount: number;
    teachersCount: number;
    classesCount: number;
    mediaCount: number;
  };
  isEditing?: boolean;
  onEditToggle?: () => void;
}

// StatBadge component
function StatBadge({ 
  label, 
  value, 
  subtext, 
  icon: Icon, 
  colorClass 
}: { 
  label: string; 
  value: string | number; 
  subtext?: string; 
  icon: React.ComponentType<{ className?: string }>; 
  colorClass: string;
}) {
  return (
    <div className="rounded-ds-lg bg-white dark:bg-slate-800 p-4 shadow-ds-card">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${colorClass}`}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{value}</div>
      {subtext && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtext}</p>
      )}
    </div>
  );
}

function PrincipalDashboardContent({
  t,
  kpis,
  isLoading = false,
  error = null,
  onRetry,
  schoolData,
  isEditing = false,
  onEditToggle,
}: PrincipalDashboardContentProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Calculate metrics from schoolData
  const capacityPercentage = schoolData 
    ? Math.round((schoolData.enrolledCount / (schoolData.maxCapacity || 1)) * 100)
    : 0;
  
  const sqMetersPerChild = schoolData && schoolData.enrolledCount > 0 && schoolData.totalFloorArea
    ? (schoolData.totalFloorArea / schoolData.enrolledCount).toFixed(1)
    : '0';

  // Helper to get icon color from border color for hover effect
  const getIconHoverColor = (borderColor: string) => {
    const colorMap: Record<string, string> = {
      'border-blue-500': 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
      'border-orange-500': 'group-hover:text-orange-600 dark:group-hover:text-orange-400',
      'border-green-500': 'group-hover:text-green-600 dark:group-hover:text-green-400',
      'border-pink-500': 'group-hover:text-pink-600 dark:group-hover:text-pink-400',
      'border-purple-500': 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
      'border-cyan-500': 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
      'border-mint-500': 'group-hover:text-mint-600 dark:group-hover:text-mint-400',
      'border-indigo-500': 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400',
      'border-teal-500': 'group-hover:text-teal-600 dark:group-hover:text-teal-400',
      'border-yellow-500': 'group-hover:text-yellow-600 dark:group-hover:text-yellow-400',
      'border-red-500': 'group-hover:text-red-600 dark:group-hover:text-red-400',
      'border-slate-500': 'group-hover:text-slate-600 dark:group-hover:text-slate-400',
    };
    return colorMap[borderColor] || 'group-hover:text-slate-600 dark:group-hover:text-slate-400';
  };

  // Navigation tiles data with colored borders
  const navigationTiles = useMemo(() => [
    {
      id: 'dashboard',
      title: t.title || 'Principal Dashboard',
      desc: 'View dashboard overview',
      Icon: LayoutDashboard,
      route: '/dashboard/principal',
      borderColor: 'border-mint-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'students',
      title: t.tile_students || 'Students',
      desc: t.tile_students_desc || 'Manage students',
      Icon: Users,
      route: '/dashboard/principal/students',
      borderColor: 'border-blue-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'staff',
      title: t.kpi_staff || 'Staff',
      desc: 'Teachers',
      Icon: School,
      route: '/dashboard/principal/staff',
      borderColor: 'border-blue-500',
      titleColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      id: 'classes',
      title: t.kpi_classes || 'Classes',
      desc: 'Manage classes',
      Icon: BarChart3,
      route: '/dashboard/principal/classes',
      borderColor: 'border-purple-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'messages',
      title: t.tile_msg || 'Messages',
      desc: t.tile_msg_desc || 'View and send messages',
      Icon: MessageSquare,
      route: '/dashboard/principal/messages',
      borderColor: 'border-cyan-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'photos',
      title: t.kpi_photos || 'Media',
      desc: 'Gallery',
      Icon: Camera,
      route: '/dashboard/principal/photos',
      borderColor: 'border-pink-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'calendar',
      title: t.tile_calendar || 'Calendar',
      desc: 'Events',
      Icon: CalendarDays,
      route: '/dashboard/principal/calendar',
      borderColor: 'border-green-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'guardians',
      title: t.tile_guardians || 'Guardians',
      desc: t.tile_guardians_desc || 'Manage guardians',
      Icon: Shield,
      route: '/dashboard/principal/guardians',
      borderColor: 'border-indigo-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'link_student',
      title: t.tile_link_student || 'Link Student',
      desc: t.tile_link_student_desc || 'Link a guardian to a student',
      Icon: LinkIcon,
      route: '/dashboard/principal/link-student',
      borderColor: 'border-teal-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'menus',
      title: t.tile_menus || 'Menu',
      desc: 'Dietary',
      Icon: Utensils,
      route: '/dashboard/principal/menus',
      borderColor: 'border-orange-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'announcements',
      title: t.tile_announcements || 'Announcements',
      desc: t.tile_announcements_desc || 'Manage announcements',
      Icon: Megaphone,
      route: '/dashboard/principal/announcements',
      borderColor: 'border-yellow-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'daily_logs',
      title: t.activity_log || 'Activity Log',
      desc: t.tile_activity_log_desc || 'View and manage daily activity logs',
      Icon: Activity,
      route: '/dashboard/principal/daily-logs',
      borderColor: 'border-red-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'organization_profile',
      title: 'Organization Profile',
      desc: 'View and update organization information',
      Icon: Building,
      route: '/dashboard/principal/organization-profile',
      borderColor: 'border-slate-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
  ], [t]);

  const handleTileClick = (route: string) => {
    router.push(route);
  };

  const isTileActive = (route: string): boolean => {
    return pathname === route;
  };

  return (
    <>
      {/* Content Header */}
      <PageHeader
        title={t.title || 'Principal Dashboard'}
        subtitle={t.subtitle || 'Manage groups, staff and visibility.'}
        
        headingLevel="h1"
      />

      {/* School Information Section */}
      {schoolData && (
        <section className="mb-ds-lg space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={onEditToggle}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-medium text-sm transition-colors shadow-sm"
              >
                <Edit3 size={16} />
                {isEditing ? 'Save Values' : 'Edit Values'}
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-medium text-sm transition-colors shadow-sm">
                <Settings size={16} />
                Settings
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm">
                <Download size={16} />
                Stats Report
              </button>
            </div>
          </div>

          {/* Data Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Students / Enrollment (Hero Card) */}
            <div className="col-span-1 md:col-span-2 rounded-ds-lg bg-white dark:bg-slate-800 p-6 flex flex-col justify-center shadow-ds-card">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md text-blue-600 dark:text-blue-400">
                      <Baby className="h-[18px] w-[18px]" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Students Enrolled</p>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{schoolData.enrolledCount}</h3>
                    <span className="text-slate-400 dark:text-slate-500 font-medium">/ {schoolData.maxCapacity} capacity</span>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  capacityPercentage > 95 
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                }`}>
                  {capacityPercentage}% Full
                </div>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 mt-3 overflow-hidden">
                <div 
                  className={`h-3 rounded-full transition-all ${
                    capacityPercentage > 95 ? 'bg-red-500' : 'bg-blue-500'
                  }`} 
                  style={{ width: `${capacityPercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Spatial Stats */}
            {schoolData.totalFloorArea && (
              <StatBadge 
                label="Floor Area" 
                value={`${schoolData.totalFloorArea} m²`} 
                subtext={schoolData.playArea ? `Play area: ${schoolData.playArea} m²` : undefined}
                icon={Maximize2}
                colorClass="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
              />
            )}
            
            {sqMetersPerChild !== '0' && (
              <StatBadge 
                label="Space per Child" 
                value={`${sqMetersPerChild} m²`} 
                subtext="Based on current enrollment"
                icon={Minimize2}
                colorClass="bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
              />
            )}

            {/* People & Media Metric Cards */}
            <StatBadge 
              label="Guardians" 
              value={schoolData.guardiansCount} 
              subtext="Registered parents"
              icon={UsersRound}
              colorClass="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
            />

            <StatBadge 
              label="Teachers" 
              value={schoolData.teachersCount} 
              subtext="Active staff members"
              icon={GraduationCap}
              colorClass="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
            />

            <StatBadge 
              label="Classes" 
              value={schoolData.classesCount} 
              subtext="Active groups"
              icon={Layers}
              colorClass="bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400"
            />

            <StatBadge 
              label="Media Items" 
              value={schoolData.mediaCount.toLocaleString()} 
              subtext="Photos & Videos"
              icon={ImageIcon}
              colorClass="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400"
            />
          </div>
        </section>
      )}

      <StoryColumn
        userRole="principal"
      />
      {/* Error Message */}
      {error && (
        <div className="mb-ds-sm rounded-ds-md border border-red-200 bg-red-50 p-ds-sm dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-ds-md">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-ds-small font-medium text-red-800 dark:text-red-200">{error}</p>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-ds-md bg-red-100 px-3 py-1.5 text-ds-small font-medium text-red-700 hover:bg-red-200 transition-colors dark:bg-red-800/50 dark:text-red-200 dark:hover:bg-red-800/70"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPIs Section */}
      <section className="mb-ds-lg">
        {isLoading ? (
          <KPICardSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-ds-md sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map(({ label, value, icon: Icon }, i) => {
              // Cycle through tinted backgrounds: pale-blue, pale-yellow, pale-peach, pale-green
              const bgColors = [
                'bg-pale-blue dark:bg-slate-800',
                'bg-pale-yellow dark:bg-slate-800',
                'bg-pale-peach dark:bg-slate-800',
                'bg-pale-green dark:bg-slate-800',
              ];
              const bgColor = bgColors[i % 4];

              return (
                <div
                  key={i}
                  className={`rounded-ds-lg ${bgColor} p-ds-md shadow-ds-card`}
                >
                  <div className="text-ds-small text-ds-text-secondary dark:text-slate-400 mb-2">{label}</div>
                  <div className="flex items-center justify-between">
                    <div className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">{value}</div>
                    <span className="rounded-ds-md bg-white/50 dark:bg-slate-700/50 p-2">
                      <Icon className="h-5 w-5 text-ds-text-primary dark:text-slate-300" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Navigation Tiles Section */}
      <section className="mb-ds-lg">
        <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 mb-ds-md">
          Navigation
        </h2>
        <div className="grid grid-cols-1 gap-ds-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {navigationTiles.map((tile) => {
            const active = isTileActive(tile.route);
            const borderColor = tile.borderColor || 'border-slate-500';
            const titleColor = tile.titleColor || 'text-slate-900 dark:text-slate-100';
            // Get hover border color class
            const getHoverBorderClass = (borderColor: string) => {
              const colorMap: Record<string, string> = {
                'border-blue-500': 'hover:border-blue-500',
                'border-orange-500': 'hover:border-orange-500',
                'border-green-500': 'hover:border-green-500',
                'border-pink-500': 'hover:border-pink-500',
                'border-purple-500': 'hover:border-purple-500',
                'border-cyan-500': 'hover:border-cyan-500',
                'border-mint-500': 'hover:border-mint-500',
                'border-indigo-500': 'hover:border-indigo-500',
                'border-teal-500': 'hover:border-teal-500',
                'border-yellow-500': 'hover:border-yellow-500',
                'border-red-500': 'hover:border-red-500',
                'border-slate-500': 'hover:border-slate-500',
              };
              return colorMap[borderColor] || 'hover:border-slate-500';
            };

            // Get background color class for top border from border color
            const getTopBorderBgColor = (borderColor: string) => {
              const colorMap: Record<string, string> = {
                'border-blue-500': 'bg-blue-500',
                'border-orange-500': 'bg-orange-500',
                'border-green-500': 'bg-green-500',
                'border-pink-500': 'bg-pink-500',
                'border-purple-500': 'bg-purple-500',
                'border-cyan-500': 'bg-cyan-500',
                'border-mint-500': 'bg-mint-500',
                'border-indigo-500': 'bg-indigo-500',
                'border-teal-500': 'bg-teal-500',
                'border-yellow-500': 'bg-yellow-500',
                'border-red-500': 'bg-red-500',
                'border-slate-500': 'bg-slate-500',
              };
              return colorMap[borderColor] || 'bg-mint-500';
            };

            return (
              <button
                key={tile.id}
                onClick={() => handleTileClick(tile.route)}
                className={`
                  group relative bg-white dark:bg-slate-800 rounded-ds-lg shadow-ds-card text-left transition-all duration-300
                  hover:shadow-ds-card-hover hover:scale-[1.02] overflow-hidden
                  border-2 border-transparent ${getHoverBorderClass(borderColor)}
                  ${active ? 'ring-2 ring-mint-500' : ''}
                `}
              >
                {/* Colored Top Border */}
                <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-ds-lg ${getTopBorderBgColor(borderColor)}`}></div>
                
                {/* Content */}
                <div className="p-ds-md pt-5">
                  {/* Icon */}
                  <div className="mb-3">
                    <tile.Icon className={`h-8 w-8 text-slate-600 dark:text-slate-400 transition-colors duration-300 ${getIconHoverColor(borderColor)}`} />
                  </div>
                  
                  {/* Title */}
                  <div className={`font-bold text-base mb-1 ${titleColor}`}>
                    {tile.title}
                  </div>
                  
                  {/* Subtitle */}
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {tile.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* user card section */}

      {/* <UserCard
        user={{
          id: '1',
          org_id: 'org-1',
          email: 'maria@domain.is',
          phone: '777-1334',
          ssn: null,
          address: 'Jhress: JJohanna 9',
          canLogin: true,
          first_name: 'Mária',
          last_name: 'Jónsdóttir',
          role: 'staff',
          bio: null,
          avatar_url: null,
          gender: 'female',
          last_login_at: null,
          is_active: true,
          is_staff: true,
          status: 'active',
          dob: null,
          theme: 'light',
          language: 'is',
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }}
        onCall={() => {
          // Handle call action
          console.log('Call Mária Jónsdóttir');
        }}
        onMessage={() => {
          // Handle message action
          console.log('Message Mária Jónsdóttir');
        }}
        onViewProfile={() => {
          // Handle view profile action
          console.log('View profile Mária Jónsdóttir');
        }}
      /> */}
    </>
  );
}

function PrincipalDashboardPageContent() {
  const { t } = useLanguage();
  const { session } = useAuth?.() || {} as any;

  // KPI data states - simplified initialization
  const [studentsCount, setStudentsCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [classesCount, setClassesCount] = useState(0);
  const [menusCount, setMenusCount] = useState(0);

  // Organization/school data state
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [mediaCount, setMediaCount] = useState(0);
  const [guardiansCount, setGuardiansCount] = useState(0);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch organization data
  const fetchOrganization = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await fetch(`/api/orgs/my-org?t=${Date.now()}`, {
        cache: 'no-store',
        signal,
        credentials: 'include',
      });

      if (signal.aborted) {
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (data.org) {
          setOrganization(data.org);
        }
      }
    } catch (err) {
      if (!signal.aborted) {
        console.error('Error loading organization:', err);
      }
    }
  }, []);

  // Fetch additional counts (guardians, media)
  const fetchAdditionalCounts = useCallback(async (signal: AbortSignal) => {
    try {
      // Fetch guardians count
      try {
        if (signal.aborted) return;
        const guardiansRes = await fetch(`/api/guardians?t=${Date.now()}`, {
          cache: 'no-store',
          signal,
          credentials: 'include',
        });
        
        if (signal.aborted) return;
        
        if (guardiansRes.ok) {
          try {
            const guardiansData = await guardiansRes.json();
            if (guardiansData.guardians && Array.isArray(guardiansData.guardians)) {
              setGuardiansCount(guardiansData.guardians.length || 0);
            }
          } catch (parseErr) {
            console.warn('Error parsing guardians response:', parseErr);
            setGuardiansCount(0);
          }
        } else {
          // API returned error status, set to 0
          setGuardiansCount(0);
        }
      } catch (guardiansErr) {
        if (!signal.aborted) {
          console.warn('Error loading guardians count:', guardiansErr);
          setGuardiansCount(0);
        }
      }

      // Fetch media count (photos)
      try {
        if (signal.aborted) return;
        const photosRes = await fetch(`/api/photos?t=${Date.now()}`, {
          cache: 'no-store',
          signal,
          credentials: 'include',
        });
        
        if (signal.aborted) return;
        
        if (photosRes.ok) {
          try {
            const photosData = await photosRes.json();
            if (photosData.photos && Array.isArray(photosData.photos)) {
              setMediaCount(photosData.photos.length || 0);
            }
          } catch (parseErr) {
            console.warn('Error parsing photos response:', parseErr);
            setMediaCount(0);
          }
        } else {
          // API returned error status, set to 0
          setMediaCount(0);
        }
      } catch (photosErr) {
        if (!signal.aborted) {
          console.warn('Error loading photos count:', photosErr);
          setMediaCount(0);
        }
      }
    } catch (err) {
      if (!signal.aborted) {
        console.error('Error loading additional counts:', err);
        // Set defaults on error
        setGuardiansCount(0);
        setMediaCount(0);
      }
    }
  }, []);

  // Single consolidated function to fetch all metrics
  const fetchMetrics = useCallback(async (signal: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);

      // API gets all data from authenticated session, no query params needed
      const res = await fetch(`/api/principal-dashboard-metrics?t=${Date.now()}`, {
        cache: 'no-store',
        signal,
        credentials: 'include',
      });

      if (signal.aborted) {
        return;
      }

      if (!res.ok) {
        // Try to parse as JSON first, fallback to text
        let errorMessage = `HTTP ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If JSON parsing fails, try text
          try {
            const errorText = await res.text();
            errorMessage = errorText || errorMessage;
          } catch {
            // Use default error message
          }
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();

      if (signal.aborted) {
        return;
      }

      // Update all state variables from the response
      setStudentsCount(data.studentsCount || 0);
      setStaffCount(data.staffCount || 0);
      setClassesCount(data.classesCount || 0);
      setMenusCount(data.menusCount || 0);
    } catch (err: unknown) {
      if (signal.aborted) {
        return;
      }

      const message =
        err instanceof Error ? err.message : 'Failed to load dashboard metrics. Please try again.';
      setError(message);
      console.error('Error loading metrics:', err);
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Main effect: Load metrics on mount
  useEffect(() => {
    if (!session?.user?.id) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    void fetchMetrics(abortController.signal);
    void fetchOrganization(abortController.signal);
    void fetchAdditionalCounts(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [session?.user?.id, fetchMetrics, fetchOrganization, fetchAdditionalCounts]);

  // Retry function
  const handleRetry = useCallback(() => {
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    void fetchMetrics(abortController.signal);
    void fetchOrganization(abortController.signal);
    void fetchAdditionalCounts(abortController.signal);
  }, [fetchMetrics, fetchOrganization, fetchAdditionalCounts]);

  // Stable icon references
  const icons = useMemo(() => ({
    Users,
    School,
    BarChart3,
    Utensils,
  }), []);

  // Memoize KPIs array with stable references
  const kpis = useMemo<KPICard[]>(() => [
    {
      label: t.kpi_students || 'Students',
      value: studentsCount,
      icon: icons.Users,
    },
    {
      label: t.kpi_staff || 'Staff',
      value: staffCount,
      icon: icons.School,
    },
    {
      label: t.kpi_classes || 'Classes',
      value: classesCount,
      icon: icons.BarChart3,
    },
    {
      label: t.kpi_menus || 'Menus',
      value: menusCount,
      icon: icons.Utensils,
    },
  ], [t, studentsCount, staffCount, classesCount, menusCount, icons]);

  // Prepare school data for the school information section
  const schoolData = useMemo(() => {
    if (!organization) return undefined;

    return {
      name: organization.name || 'School',
      address: organization.address || undefined,
      kennitala: undefined, // Not in Organization type, would need to be added
      type: organization.type || undefined,
      enrolledCount: studentsCount,
      maxCapacity: organization.maximum_allowed_students || studentsCount || 1,
      totalFloorArea: organization.total_area ? Number(organization.total_area) : undefined,
      playArea: organization.play_area ? Number(organization.play_area) : undefined,
      guardiansCount,
      teachersCount: staffCount,
      classesCount,
      mediaCount,
    };
  }, [organization, studentsCount, staffCount, classesCount, guardiansCount, mediaCount]);

  return (
    <PrincipalPageLayout>
      <PrincipalDashboardContent 
        t={t} 
        kpis={kpis} 
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        schoolData={schoolData}
        isEditing={isEditing}
        onEditToggle={() => setIsEditing(!isEditing)}
      />
    </PrincipalPageLayout>
  );
}

export default function PrincipalDashboardPage() {
  return (
    <Suspense fallback={
      <PrincipalPageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <KPICardSkeleton count={4} />
        </div>
      </PrincipalPageLayout>
    }>
      <PrincipalDashboardPageContent />
    </Suspense>
  );
}
