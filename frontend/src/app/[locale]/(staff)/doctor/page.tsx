import { setRequestLocale } from 'next-intl/server';
import { DoctorConsole } from '@/features/doctor/components/DoctorConsole';

/** The doctor's room. Data and auth are resolved on the client (staff token + live socket). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <DoctorConsole />;
}
