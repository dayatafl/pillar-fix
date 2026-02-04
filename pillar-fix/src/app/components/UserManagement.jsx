import { useState } from 'react';
import { UserPlus, UserX, Users, Shield, Edit, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { Switch } from '@/app/components/ui/switch';
import { toast } from 'sonner';

export function UserManagement({ currentUser, users, onUpdateUsers }) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    username: '',
    employeeId: '',
    role: 'technician',
    password: '',
  });
  const [editUser, setEditUser] = useState({
    name: '',
    email: '',
    username: '',
    employeeId: '',
    role: 'technician',
  });

  const handleCreateUser = () => {
    // Validation
    if (!newUser.name || !newUser.email || !newUser.username || !newUser.employeeId || !newUser.password) {
      toast.error('All fields are required');
      return;
    }

    // Check if email or username already exists
    if (users.some(u => u.email === newUser.email)) {
      toast.error('Email already exists');
      return;
    }

    if (users.some(u => u.username === newUser.username)) {
      toast.error('Username already exists');
      return;
    }

    const user = {
      id: Date.now().toString(),
      name: newUser.name,
      email: newUser.email,
      username: newUser.username,
      employeeId: newUser.employeeId,
      role: newUser.role,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
    };

    onUpdateUsers([...users, user]);
    toast.success(`User ${user.name} created successfully`);
    setIsCreateDialogOpen(false);
    setNewUser({
      name: '',
      email: '',
      username: '',
      employeeId: '',
      role: 'technician',
      password: '',
    });
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditUser({
      name: user.name,
      email: user.email,
      username: user.username,
      employeeId: user.employeeId,
      role: user.role,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = () => {
    // Validation
    if (!editUser.name || !editUser.email || !editUser.username || !editUser.employeeId) {
      toast.error('All fields are required');
      return;
    }

    // Check if email or username already exists (excluding current user)
    if (users.some(u => u.email === editUser.email && u.id !== selectedUser.id)) {
      toast.error('Email already exists');
      return;
    }

    if (users.some(u => u.username === editUser.username && u.id !== selectedUser.id)) {
      toast.error('Username already exists');
      return;
    }

    const updatedUsers = users.map(user =>
      user.id === selectedUser.id
        ? { ...user, ...editUser }
        : user
    );
    onUpdateUsers(updatedUsers);
    toast.success(`User ${editUser.name} updated successfully`);
    setIsEditDialogOpen(false);
    setSelectedUser(null);
  };

  const handleDeleteUser = (user) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = () => {
    const updatedUsers = users.filter(u => u.id !== selectedUser.id);
    onUpdateUsers(updatedUsers);
    toast.success(`User ${selectedUser.name} deleted successfully`);
    setIsDeleteDialogOpen(false);
    setSelectedUser(null);
  };

  const handleToggleUserStatus = (userId) => {
    const updatedUsers = users.map(user =>
      user.id === userId
        ? { ...user, isActive: !user.isActive }
        : user
    );
    onUpdateUsers(updatedUsers);

    const user = users.find(u => u.id === userId);
    if (user) {
      toast.success(`User ${user.name} ${!user.isActive ? 'activated' : 'deactivated'}`);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'manager':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'supervisor':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'technician':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">Manage system users and their access levels</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.isActive).length}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Users</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => !u.isActive).length}</div>
            <p className="text-xs text-muted-foreground">Currently inactive</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administrators</CardTitle>
            <Shield className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</div>
            <p className="text-xs text-muted-foreground">System admins</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>A list of all users in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.employeeId}</TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(user.role)} variant="outline">
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.isActive}
                        onCheckedChange={() => handleToggleUserStatus(user.id)}
                        disabled={user.id === currentUser.id}
                        className={user.isActive ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-600'}
                      />
                      <span className={`text-sm font-medium ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                        disabled={user.id === currentUser.id}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.id === currentUser.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the PillarFix system. All fields are required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="john@tnb.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="johndoe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="employeeId">Employee ID</Label>
              <Input
                id="employeeId"
                value={newUser.employeeId}
                onChange={(e) => setNewUser({ ...newUser, employeeId: e.target.value })}
                placeholder="EMP001"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value) => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Initial Password</Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Temporary password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information. All fields are required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editUser.name}
                onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                placeholder="john@tnb.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editUser.username}
                onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
                placeholder="johndoe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-employeeId">Employee ID</Label>
              <Input
                id="edit-employeeId"
                value={editUser.employeeId}
                onChange={(e) => setEditUser({ ...editUser, employeeId: e.target.value })}
                placeholder="EMP001"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editUser.role}
                onValueChange={(value) => setEditUser({ ...editUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser}>Update User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="rounded-lg border p-4 bg-red-50 border-red-200">
                <p className="font-medium text-red-900">{selectedUser.name}</p>
                <p className="text-sm text-red-700">{selectedUser.email}</p>
                <p className="text-sm text-red-700">Employee ID: {selectedUser.employeeId}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteUser}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
