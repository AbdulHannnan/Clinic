import { setRequestLocale } from 'next-intl/server';
import { PatientPortal } from '@/features/patient/components/PatientPortal';

/** The patient portal. Auth and live status are resolved on the client (patient token). */
export default async function PatientPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PatientPortal />;
}
