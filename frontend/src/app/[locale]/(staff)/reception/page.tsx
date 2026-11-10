import { setRequestLocale } from 'next-intl/server';
import { ReceptionDesk } from '@/features/reception/components/ReceptionDesk';

/** The management desk. Data and auth are resolved on the client (staff token + live socket). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ReceptionDesk />;
}
