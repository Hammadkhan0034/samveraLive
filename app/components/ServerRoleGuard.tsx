import { 
  requireServerAuth, 
  requireServerRole, 
  requireServerRoles,
  requireServerRoleLevel
} from '@/lib/supabaseServer';
import { type SamveraRole } from '@/lib/auth';

// Helper functions for permission checks
async function hasPermission(role: SamveraRole): Promise<boolean> {
  try {
    await requireServerRole(role);
    return true;
  } catch {
    return false;
  }
}

async function hasAnyPermission(roles: SamveraRole[]): Promise<boolean> {
  try {
    await requireServerRoles(roles);
    return true;
  } catch {
    return false;
  }
}

async function hasMinimumPermission(role: SamveraRole): Promise<boolean> {
  try {
    await requireServerRoleLevel(role);
    return true;
  } catch {
    return false;
  }
}

// Server component that demonstrates role-based rendering
export async function ServerRoleGuard({ 
  children, 
  requiredRole, 
  requiredRoles, 
  minimumRole,
  fallback 
}: {
  children: React.ReactNode;
  requiredRole?: SamveraRole;
  requiredRoles?: SamveraRole[];
  minimumRole?: SamveraRole;
  fallback?: React.ReactNode;
}): Promise<JSX.Element> {
  try {
    if (requiredRole) {
      await requireServerRole(requiredRole);
    } else if (requiredRoles) {
      await requireServerRoles(requiredRoles);
    } else if (minimumRole) {
      await requireServerRoleLevel(minimumRole);
    } else {
      await requireServerAuth();
    }
    
    return <>{children}</>;
  } catch (error) {
    console.error('ServerRoleGuard error:', error);
    return <>{fallback || null}</>;
  }
}

// Server component that conditionally renders based on permissions
export async function ConditionalServerContent() {
  const isAdmin = await hasPermission('admin');
  const isTeacherOrAbove = await hasMinimumPermission('teacher');
  const canManageUsers = await hasAnyPermission(['admin', 'principal']);
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Server-Side Role Validation</h2>
      
      {isAdmin && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-medium text-red-800">Admin Only Content</h3>
          <p className="text-red-600">This content is only visible to admins.</p>
        </div>
      )}
      
      {isTeacherOrAbove && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-800">Teacher+ Content</h3>
          <p className="text-blue-600">This content is visible to teachers, principals, and admins.</p>
        </div>
      )}
      
      {canManageUsers && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-medium text-green-800">User Management</h3>
          <p className="text-green-600">You can manage users (principal+ access).</p>
        </div>
      )}
      
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-medium text-gray-800">Public Content</h3>
        <p className="text-gray-600">This content is visible to all authenticated users.</p>
      </div>
    </div>
  );
}

// Server component that shows user's current permissions
export async function UserPermissionsDisplay() {
  const { user, session } = await requireServerAuth();
  
  const userRoles = user.user_metadata?.roles || [];
  const activeRole = user.user_metadata?.activeRole;
  
  const permissions = {
    isAdmin: await hasPermission('admin'),
    isPrincipal: await hasPermission('principal'),
    isTeacher: await hasPermission('teacher'),
    isParent: await hasPermission('parent'),
    canManageUsers: await hasAnyPermission(['admin', 'principal']),
    canCreateContent: await hasMinimumPermission('teacher'),
  };
  
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <h3 className="font-semibold text-gray-900 mb-3">Your Permissions</h3>
      
      <div className="space-y-2">
        <div>
          <span className="font-medium">User ID:</span> {user.id}
        </div>
        <div>
          <span className="font-medium">Roles:</span> {userRoles.join(', ')}
        </div>
        <div>
          <span className="font-medium">Active Role:</span> {activeRole}
        </div>
      </div>
      
      <div className="mt-4">
        <h4 className="font-medium text-gray-700 mb-2">Permissions:</h4>
        <ul className="space-y-1 text-sm">
          <li className={permissions.isAdmin ? 'text-green-600' : 'text-gray-400'}>
            ✓ Admin Access: {permissions.isAdmin ? 'Yes' : 'No'}
          </li>
          <li className={permissions.isPrincipal ? 'text-green-600' : 'text-gray-400'}>
            ✓ Principal Access: {permissions.isPrincipal ? 'Yes' : 'No'}
          </li>
          <li className={permissions.isTeacher ? 'text-green-600' : 'text-gray-400'}>
            ✓ Teacher Access: {permissions.isTeacher ? 'Yes' : 'No'}
          </li>
          <li className={permissions.isParent ? 'text-green-600' : 'text-gray-400'}>
            ✓ Parent Access: {permissions.isParent ? 'Yes' : 'No'}
          </li>
          <li className={permissions.canManageUsers ? 'text-green-600' : 'text-gray-400'}>
            ✓ Can Manage Users: {permissions.canManageUsers ? 'Yes' : 'No'}
          </li>
          <li className={permissions.canCreateContent ? 'text-green-600' : 'text-gray-400'}>
            ✓ Can Create Content: {permissions.canCreateContent ? 'Yes' : 'No'}
          </li>
        </ul>
      </div>
    </div>
  );
}
