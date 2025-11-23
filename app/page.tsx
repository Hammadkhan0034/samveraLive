// Landing Page Code.
'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useTheme } from '@/lib/contexts/ThemeContext';
import { motion } from 'framer-motion';
import {
  CalendarDays, MessageSquare, Shield, Camera, Baby, ShoppingBag, CheckSquare,
  Cloud, Users, ArrowRight, PlayCircle, Timer, Plus, Bell, Globe, Sun, Moon, ChevronDown, Monitor
} from 'lucide-react';


export default function SamveraLanding() {
  const { lang, setLang, t } = useLanguage();
  const { isDark, theme, toggleTheme } = useTheme();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isLangDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('.language-dropdown')) {
          setIsLangDropdownOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLangDropdownOpen]);

  const features = [
    { icon: CalendarDays, title: t.f_calendar_title, desc: t.f_calendar_desc },
    { icon: MessageSquare, title: t.f_messaging_title, desc: t.f_messaging_desc },
    { icon: CheckSquare, title: t.f_attendance_title, desc: t.f_attendance_desc },
    { icon: Baby, title: t.f_diaper_title, desc: t.f_diaper_desc },
    { icon: Camera, title: t.f_media_title, desc: t.f_media_desc },
    { icon: PlayCircle, title: t.f_stories24_title, desc: t.f_stories24_desc },
    { icon: ShoppingBag, title: t.f_orders_title, desc: t.f_orders_desc },
    { icon: Shield, title: t.f_security_title, desc: t.f_security_desc },
    // Updated to call out Scaleway explicitly
    { icon: Cloud, title: t.f_cloud_title, desc: t.f_cloud_desc },
  ];

  const roles = [
    { name: t.role_admin_title, points: [t.role_admin_1, t.role_admin_2, t.role_admin_3] },
    { name: t.role_teacher_title, points: [t.role_teacher_1, t.role_teacher_2, t.role_teacher_3] },
    { name: t.role_parent_title, points: [t.role_parent_1, t.role_parent_2, t.role_parent_3] },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-700 bg-white/75 dark:bg-slate-900/75 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <a href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900">S</span>
            <span className="font-medium">Samvera</span>
          </a>
          <nav className="hidden items-center gap-6 md:flex">
            <a className="hover:text-slate-900 dark:hover:text-slate-100" href="#features">{t.nav_features}</a>
            <a className="hover:text-slate-900 dark:hover:text-slate-100" href="#roles">{t.nav_roles}</a>
            <a className="hover:text-slate-900 dark:hover:text-slate-100" href="#security">{t.nav_security}</a>
            <a className="hover:text-slate-900 dark:hover:text-slate-100" href="#contact">{t.nav_contact}</a>
            <a className="rounded-xl bg-slate-900 dark:bg-slate-100 px-3 py-1.5 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200" href="/signin">{t.nav_signin}</a>
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              aria-label={
                theme === 'light' 
                  ? "Switch to dark mode" 
                  : theme === 'dark' 
                  ? "Switch to system mode" 
                  : "Switch to light mode"
              }
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              {theme === 'light' ? (
                <Sun size={16} />
              ) : theme === 'dark' ? (
                <Moon size={16} />
              ) : (
                <Monitor size={16} />
              )}
            </button>
            <a className="rounded-xl bg-slate-900 dark:bg-slate-100 px-3 py-1.5 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200" href="/signin">{t.nav_signin}</a>
          </div>
          <div className="ml-4 hidden md:flex items-center gap-3">
            <button
              type="button"
              aria-label={
                theme === 'light' 
                  ? "Switch to dark mode" 
                  : theme === 'dark' 
                  ? "Switch to system mode" 
                  : "Switch to light mode"
              }
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              {theme === 'light' ? (
                <Sun size={16} />
              ) : theme === 'dark' ? (
                <Moon size={16} />
              ) : (
                <Monitor size={16} />
              )}
            </button>
            <div className="relative language-dropdown">
              <button
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <Globe className="h-4 w-4" />
                <span>{lang === 'is' ? 'Íslenska' : 'English'}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isLangDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-50">
                  <button
                    onClick={() => {
                      setLang('en');
                      setIsLangDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 first:rounded-t-lg ${lang === 'en' ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => {
                      setLang('is');
                      setIsLangDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 last:rounded-b-lg ${lang === 'is' ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    Íslenska
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="home" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
          <div className="absolute -left-10 -top-10 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-100 to-teal-100 blur-2xl" />
          <div className="absolute -bottom-10 -right-10 h-72 w-72 rounded-full bg-gradient-to-tr from-teal-100 to-emerald-100 blur-2xl" />
        </div>
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
          <div>
            <motion.h1 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="text-4xl font-bold tracking-tight md:text-5xl">
              {t.hero_title}
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
              className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-300">
              {t.hero_sub}
            </motion.p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/signin" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 px-5 py-3 text-white dark:text-slate-900 shadow hover:bg-slate-800 dark:hover:bg-slate-200">
                {t.cta_demo} <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#features" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-5 py-3 hover:bg-slate-100 dark:hover:bg-slate-800">
                {t.cta_explore}
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <div className="inline-flex items-center gap-2"><Shield className="h-4 w-4" /> GDPR • RBAC • Audit</div>
              <div className="inline-flex items-center gap-2"><Cloud className="h-4 w-4" /> {t.hero_cloud}</div>
              <div className="inline-flex items-center gap-2"><Globe className="h-4 w-4" /> IS/EN</div>
            </div>
          </div>

          {/* Mock card */}
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="relative mx-auto w-full max-w-xl">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-4 py-2">
                <span className="h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span className="h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span className="h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">{t.mock_title}</span>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 md:col-span-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-medium">{t.mock_stories}</div>
                    <Timer className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </div>
                  <div className="flex gap-4 overflow-x-auto py-1">
                    <button className="flex w-16 flex-col items-center gap-1">
                        <span className="rounded-full bg-gradient-to-tr from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-500 p-0.5">
                        <span className="block rounded-full bg-white dark:bg-slate-700 p-0.5">
                          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-slate-300 dark:border-slate-600">
                            <Plus className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                          </span>
                        </span>
                      </span>
                      <span className="truncate text-xs text-slate-600 dark:text-slate-300">{t.mock_add_story}</span>
                    </button>
                    {['Blue Room', 'Green Room', 'Yellow Room', 'Red Room'].map((n, i) => (
                      <div key={i} className="flex w-16 flex-col items-center gap-1">
                        <span className="rounded-full bg-gradient-to-tr from-rose-400 to-amber-400 p-0.5">
                          <span className="block rounded-full bg-white dark:bg-slate-700 p-0.5">
                            <span className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-600" />
                          </span>
                        </span>
                        <span className="truncate text-xs text-slate-600 dark:text-slate-300">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-medium">{t.mock_feed}</div>
                    <Bell className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </div>
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <p>• {t.mock_post1}</p>
                    <p>• {t.mock_post2}</p>
                    <p>• {t.mock_post3}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3">
                  <div className="mb-2 font-medium">{t.mock_today}</div>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <li>08:30 — {t.mock_breakfast}</li>
                    <li>10:00 — {t.mock_outdoor}</li>
                    <li>12:00 — {t.mock_lunch}</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 md:col-span-2">
                  <div className="mb-2 font-medium">{t.mock_attendance}</div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <span key={i} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 text-emerald-800 dark:text-emerald-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t.mock_child} {i + 1}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t.features_title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.features_sub}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: idx * 0.03 }}
              className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm hover:shadow dark:hover:shadow-lg">
              <div className="mb-3 inline-flex rounded-xl border border-slate-200 dark:border-slate-600 p-2"><Icon className="h-5 w-5" /></div>
              <div className="font-medium">{title}</div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t.roles_title}</h2>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">{t.roles_sub}</p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {roles.map((role, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
              <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4" /> {role.name}
              </div>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {role.points.map((p, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section id="security" className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t.security_title}</h2>
              <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">{t.security_sub}</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[t.security_1, t.security_2, t.security_3, t.security_4].map((item, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-200 dark:border-slate-600 p-5">
                <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4" /> {t.security_badge}
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">{item}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{t.security_note}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-600 dark:text-slate-300 md:flex-row md:px-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900">S</span>
            <span>© {new Date().getFullYear()} Samvera</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <Cloud className="h-4 w-4" /> {t.footer_hosting}
            </span>
            <a href="#security" className="hover:text-slate-900 dark:hover:text-slate-100">{t.footer_security}</a>
            <a href="/signin" className="hover:text-slate-900 dark:hover:text-slate-100">{t.nav_signin}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

