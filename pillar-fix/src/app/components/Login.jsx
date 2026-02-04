import { useState } from 'react';
import { LogIn, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import logo from './logo/FINAL.svg'

export function Login({ onLogin }) {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!emailOrUsername || !password) {
      setError('Email/username or Password required');
      return;
    }

    setLoading(true);

    // Simulate login API call
    setTimeout(() => {
      // Mock authentication - In real app, this would be API call
      const mockUsers = {
        'admin@tnb.com': {
          password: 'admin123',
          user: {
            id: '1',
            name: 'Admin User',
            email: 'admin@tnb.com',
            username: 'admin',
            employeeId: 'EMP001',
            role: 'admin',
            isActive: true,
            createdAt: new Date().toISOString(),
          },
        },
        'manager@tnb.com': {
          password: 'manager123',
          user: {
            id: '2',
            name: 'Sarah Johnson',
            email: 'manager@tnb.com',
            username: 'manager',
            employeeId: 'EMP002',
            role: 'manager',
            isActive: true,
            createdAt: new Date().toISOString(),
          },
        },
        'supervisor@tnb.com': {
          password: 'super123',
          user: {
            id: '3',
            name: 'John Smith',
            email: 'supervisor@tnb.com',
            username: 'supervisor',
            employeeId: 'EMP003',
            role: 'supervisor',
            isActive: true,
            createdAt: new Date().toISOString(),
          },
        },
        'tech@tnb.com': {
          password: 'tech123',
          user: {
            id: '4',
            name: 'Ahmad Rahman',
            email: 'tech@tnb.com',
            username: 'technician',
            employeeId: 'EMP004',
            role: 'technician',
            isActive: true,
            createdAt: new Date().toISOString(),
          },
        },
      };

      const userEntry = mockUsers[emailOrUsername.toLowerCase()];

      if (!userEntry || userEntry.password !== password) {
        setError('Invalid email/username or password');
        setLoading(false);
        return;
      }

      onLogin(userEntry.user);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="flex items-center justify-center mb-2">
            <img src={logo} className='w-12'/>
          </div>
          <CardTitle className = "text-3xl font-bold text-center">
          <span className="text-3xl font-bold text-center bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
            Pillar
            </span>
            <span className = "text-red-500">
            Fix
            </span>
          </CardTitle>
          <CardDescription className="text-center">
            Intelligent Feeder Pillar Maintenance System
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailOrUsername">Email or Username</Label>
              <Input
                id="emailOrUsername"
                type="text"
                placeholder="Enter your email or username"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-semibold text-blue-900 mb-2">Demo Credentials:</p>
              <div className="space-y-1 text-xs text-blue-700">
                <p><strong>Admin:</strong> admin@tnb.com / admin123</p>
                <p><strong>Manager:</strong> manager@tnb.com / manager123</p>
                <p><strong>Supervisor:</strong> supervisor@tnb.com / super123</p>
                <p><strong>Technician:</strong> tech@tnb.com / tech123</p>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
