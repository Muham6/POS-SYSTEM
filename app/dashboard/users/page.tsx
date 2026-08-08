import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AddCashierForm from '@/components/add-cashier-form'
import UserActions from '@/components/user-actions'

type UserProfile = {
  id: string
  full_name: string | null
  email: string | null
  role: string
  is_active: boolean
}

export default async function UsersPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active')
    .order('full_name')

  const rows = (users as UserProfile[]) || []

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Users</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {u.full_name || 'Unnamed'}
                      {u.id === profile.id && <span className="ml-2 text-xs text-neutral-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{u.email || '—'}</td>
                    <td className="px-4 py-3 capitalize text-neutral-700">{u.role}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UserActions userId={u.id} isActive={u.is_active} isSelf={u.id === profile.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <AddCashierForm />
        </div>
      </div>
    </div>
  )
}