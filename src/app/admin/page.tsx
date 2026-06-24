import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import UserAdmin from '@/components/UserAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.userType !== 'trainer') redirect('/');

  return <UserAdmin currentUserId={session.userId} />;
}
