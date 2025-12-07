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

    <html lang="is" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme');
                  let shouldUseDark = false; // Default to light (matching ThemeProvider DEFAULT_THEME)
                  
                  if (savedTheme === 'dark') {
                    shouldUseDark = true;
                  } else {
                    // No saved theme or 'light', default to light (matching ThemeProvider behavior)
                    shouldUseDark = false;
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
                    document.documentElement.setAttribute('lang', 'is');
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
