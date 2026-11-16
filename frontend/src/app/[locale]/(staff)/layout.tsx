import { StaffNav } from '@/components/StaffNav';
import { ThemeToggle } from '@/components/ThemeToggle';

/** Staff area (management desk and doctor's room). Login and role checks go here. */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex justify-end">
        <ThemeToggle />
      </div>
      <StaffNav />
      {children}
    </div>
  );
}
