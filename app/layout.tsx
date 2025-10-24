import './globals.css';
import type { Metadata } from 'next';
import { testSupabaseConnection } from "@/lib/testSupabaseConnection"
import { AuthProvider } from '@/lib/auth-context';
import { LanguageProvider } from '@/lib/contexts/LanguageContext';

export const metadata: Metadata = {
  title: 'Samvera',
  icons: { icon: '/favicon.svg' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {

   // Run the connection test once when server starts
   await testSupabaseConnection()
  return (
    
    <html lang="en">
      <body>
        <LanguageProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
