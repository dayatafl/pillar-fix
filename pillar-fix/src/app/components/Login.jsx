import { useState } from 'react';
import { LogIn, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import logo from './logo/FINAL.svg'
import api from "@/app/api";

export function Login({ onLogin }) {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!emailOrUsername || !password) { setError("All fields required"); return; }
    setLoading(true);

    try {
      const { data } = await api.post("/users/login", {
        email: emailOrUsername,
        password: password,
      });
      if (!data.exists) {
        setError("Invalid credentials");
      } else {
        onLogin(data.user);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Server error");
    } finally {
      setLoading(false);
    }
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
