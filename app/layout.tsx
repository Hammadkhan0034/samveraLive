import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { LanguageProvider } from '@/lib/contexts/LanguageContext';
import { ThemeProvider } from '@/lib/contexts/ThemeContext';
import LayoutWrapper from '@/app/components/LayoutWrapper';
import { DeviceTokenManager } from '@/app/components/DeviceTokenManager';

export const metadata: Metadata = {
  title: 'Samvera',
  icons: { icon: '/favicon.svg' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (

    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme');
                  let shouldUseDark = true; // Default to dark (matching ThemeProvider DEFAULT_THEME)
                  
                  if (savedTheme === 'light') {
                    shouldUseDark = false;
                  } else if (savedTheme === 'dark') {
                    shouldUseDark = true;
                  } else if (savedTheme === 'system') {
                    // Check system preference when theme is 'system'
                    shouldUseDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  } else {
                    // No saved theme, default to dark (matching ThemeProvider behavior)
                    shouldUseDark = true;
                  }
                  
                  if (shouldUseDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedLang = localStorage.getItem('samvera_lang');
                  if (savedLang === 'is' || savedLang === 'en') {
                    document.documentElement.setAttribute('lang', savedLang);
                  } else {
                    document.documentElement.setAttribute('lang', 'en');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <DeviceTokenManager />
              <LayoutWrapper> 
                {children}
              </LayoutWrapper>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
