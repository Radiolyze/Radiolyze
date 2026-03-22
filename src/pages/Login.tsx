import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/services/authClient';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authClient.login({ username, password });
      navigate('/');
    } catch {
      setError(t('auth.invalidCredentials', 'Ungültige Anmeldedaten'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm p-8 space-y-6 rounded-xl border border-border bg-card shadow-lg">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">MedGemma Insight</h1>
          <p className="text-sm text-muted-foreground">
            {t('auth.loginPrompt', 'Bitte melden Sie sich an')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              {t('auth.username', 'Benutzername')}
            </label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              {t('auth.password', 'Passwort')}
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('auth.loggingIn', 'Anmeldung...') : t('auth.login', 'Anmelden')}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          Standard-Login: admin / admin
        </p>
      </div>
    </div>
  );
}
