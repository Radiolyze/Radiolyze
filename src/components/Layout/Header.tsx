import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Settings, User, Activity, Sun, Moon, Monitor, History, LayoutGrid, GraduationCap } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { KeyboardShortcutsSheet } from '@/components/Common/KeyboardShortcutsSheet';
import { NotificationsSheet } from '@/components/Common/NotificationsSheet';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useNotifications } from '@/hooks/useNotifications';
import { authClient } from '@/services/authClient';

export function Header() {
  const { t } = useTranslation('common');
  const location = useLocation();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [badgeBounce, setBadgeBounce] = useState(false);
  const prevUnreadCount = useRef(0);
  const { preferences, setPreference } = useUserPreferences();
  const {
    notifications,
    unreadCount,
    isLoading: notificationsLoading,
    errorMessage: notificationsError,
    refresh: refreshNotifications,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotifications();

  const currentUser = authClient.getUser();
  const displayName = currentUser?.username
    ? `Dr. ${currentUser.username.charAt(0).toUpperCase()}${currentUser.username.slice(1)}`
    : 'Dr. Radiologe';
  const displayEmail = currentUser?.username
    ? `${currentUser.username}@klinik.de`
    : 'radiologe@klinik.de';

  // Bounce badge when new notifications arrive
  useEffect(() => {
    if (unreadCount > prevUnreadCount.current && prevUnreadCount.current >= 0) {
      setBadgeBounce(true);
      setTimeout(() => setBadgeBounce(false), 600);
    }
    prevUnreadCount.current = unreadCount;
  }, [unreadCount]);

  const themeIcon = preferences.theme === 'dark' ? Moon : preferences.theme === 'light' ? Sun : Monitor;
  const ThemeIcon = themeIcon;
  const themeLabel = preferences.theme === 'dark' ? 'Dunkel' : preferences.theme === 'light' ? 'Hell' : 'System';

  const cycleTheme = () => {
    const themes: Array<'dark' | 'light' | 'system'> = ['dark', 'light', 'system'];
    const currentIndex = themes.indexOf(preferences.theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setPreference('theme', nextTheme);
  };

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const navLinkClass = (path: string) =>
    `transition-colors ${isActive(path) ? 'bg-accent text-accent-foreground' : ''}`;

  return (
    <TooltipProvider delayDuration={400}>
      <>
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Activity className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold tracking-tight">{t('app.name')}</span>
            </Link>
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground hidden sm:flex">
              {t('app.tagline')}
            </Badge>
          </div>

          {/* Center - Status */}
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span>{t('header.systemOnline')}</span>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-1">
            {/* Theme Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={cycleTheme}
                >
                  <ThemeIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Theme: {themeLabel}</TooltipContent>
            </Tooltip>

            {/* Notifications */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  onClick={() => setNotificationsOpen(true)}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center ${badgeBounce ? 'animate-bounce' : ''}`}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('header.notifications')}</TooltipContent>
            </Tooltip>

            {/* Batch Dashboard */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/batch">
                  <Button variant="ghost" size="icon" className={navLinkClass('/batch')}>
                    <LayoutGrid className="h-5 w-5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>{t('navigation.batch')}</TooltipContent>
            </Tooltip>

            {/* Training */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/training">
                  <Button variant="ghost" size="icon" className={navLinkClass('/training')}>
                    <GraduationCap className="h-5 w-5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Training Export</TooltipContent>
            </Tooltip>

            {/* History */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/history">
                  <Button variant="ghost" size="icon" className={navLinkClass('/history')}>
                    <History className="h-5 w-5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>{t('navigation.history')}</TooltipContent>
            </Tooltip>

            {/* Settings */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/settings">
                  <Button variant="ghost" size="icon" className={navLinkClass('/settings')}>
                    <Settings className="h-5 w-5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>{t('navigation.settings')}</TooltipContent>
            </Tooltip>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center ring-1 ring-primary/20 hover:ring-primary/40 transition-all">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 animate-scale-in">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{displayName}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {displayEmail}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>{t('header.profile')}</DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/settings" className="w-full">{t('navigation.settings')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
                  {t('header.keyboardShortcuts')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">{t('header.logout')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Sheets */}
        <KeyboardShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        <NotificationsSheet
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
          notifications={notifications}
          unreadCount={unreadCount}
          isLoading={notificationsLoading}
          errorMessage={notificationsError}
          onRefresh={refreshNotifications}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onClearAll={clearAll}
        />
      </>
    </TooltipProvider>
  );
}
