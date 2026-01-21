import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Settings, User, Activity, Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { KeyboardShortcutsSheet } from '@/components/Common/KeyboardShortcutsSheet';
import { NotificationsSheet } from '@/components/Common/NotificationsSheet';
import { useUserPreferences } from '@/hooks/useUserPreferences';

export function Header() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { preferences, setPreference } = useUserPreferences();

  const themeIcon = preferences.theme === 'dark' ? Moon : preferences.theme === 'light' ? Sun : Monitor;
  const ThemeIcon = themeIcon;

  const cycleTheme = () => {
    const themes: Array<'dark' | 'light' | 'system'> = ['dark', 'light', 'system'];
    const currentIndex = themes.indexOf(preferences.theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setPreference('theme', nextTheme);
  };

  return (
    <>
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold tracking-tight">MedGemma</span>
          </div>
          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
            Radiology Reporting
          </Badge>
        </div>

        {/* Center - Status (optional) */}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span>System Online</span>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={cycleTheme}
            title={`Theme: ${preferences.theme}`}
          >
            <ThemeIcon className="h-5 w-5" />
          </Button>

          {/* Notifications */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            onClick={() => setNotificationsOpen(true)}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
              3
            </span>
          </Button>

          {/* Settings */}
          <Link to="/settings">
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>Dr. Radiologe</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    radiologe@klinik.de
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profil</DropdownMenuItem>
              <DropdownMenuItem>Einstellungen</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
                Keyboard Shortcuts
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Abmelden</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sheets */}
      <KeyboardShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <NotificationsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </>
  );
}