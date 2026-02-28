import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import logo from './logo/FINAL.svg';

export function Login({ onLogin }) {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!emailOrUsername || !password) {
      setError('Email/username or Password required');
      return;
    }

    setLoading(true);

    // Simulate login API call
    setTimeout(() => {
      const mockUsers = {
        'admin@tnb.com': {
          password: 'admin123',
          user: { id: '1', name: 'Admin User', role: 'admin' },
        },
        'manager@tnb.com': {
          password: 'manager123',
          user: { id: '2', name: 'Sarah Johnson', role: 'manager' },
        },
        'supervisor@tnb.com': {
          password: 'super123',
          user: { id: '3', name: 'John Smith', role: 'supervisor' },
        },
        'tech@tnb.com': {
          password: 'tech123',
          user: { id: '4', name: 'Ahmad Rahman', role: 'technician' },
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
        <CardHeader className="flex flex-col items-center pb-0">
        {/* Changed mb-2 to mb-0 to remove the gap below the logo */}
        <div className="flex items-center justify-center mb-0">
          <img src={logo} className="w-20" alt="Logo" />
        </div>
        
        {/* Added mt-1 to provide just a tiny sliver of space if needed, 
            or use mt-0 for maximum closeness */}
        <CardTitle className="text-3xl font-bold text-center leading-tight mt-0">
          <span className="bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
            Pillar
          </span>
          <span className="text-red-500">Fix</span>
        </CardTitle>
        
        <CardDescription className="text-center mt-[-2px] text-sm">
          Intelligent Feeder Pillar Maintenance System
        </CardDescription>
      </CardHeader>

        <CardContent className="pt-8">
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
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

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
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