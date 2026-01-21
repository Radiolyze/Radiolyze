import { useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, FileText, AlertTriangle, CheckCircle, Clock, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '@/hooks/useNotifications';

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: Notification[];
  unreadCount: number;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRefresh?: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
}

const typeConfig = {
  report: { icon: FileText, color: 'text-primary' },
  urgent: { icon: AlertTriangle, color: 'text-warning' },
  system: { icon: Clock, color: 'text-muted-foreground' },
  success: { icon: CheckCircle, color: 'text-success' },
};

export function NotificationsSheet({
  open,
  onOpenChange,
  notifications,
  unreadCount,
  isLoading = false,
  errorMessage,
  onRefresh,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
}: NotificationsSheetProps) {
  useEffect(() => {
    if (open) {
      onRefresh?.();
    }
  }, [open, onRefresh]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-[400px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Benachrichtigungen
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5">
                {unreadCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Aktuelle Benachrichtigungen und System-Meldungen
          </SheetDescription>
        </SheetHeader>

        {notifications.length > 0 ? (
          <>
            <div className="flex items-center justify-between mt-4 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onMarkAllAsRead}
                disabled={unreadCount === 0}
                className="text-xs"
              >
                Alle als gelesen markieren
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Alle löschen
              </Button>
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-2 pb-4">
                {isLoading && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Benachrichtigungen werden geladen...
                  </div>
                )}
                {errorMessage && !isLoading && (
                  <div className="py-6 text-center text-sm text-destructive">
                    <AlertTriangle className="h-5 w-5 mx-auto mb-2" />
                    {errorMessage}
                  </div>
                )}
                {notifications.map((notification) => {
                  const config = typeConfig[notification.type];
                  const Icon = config.icon;

                  return (
                    <button
                      key={notification.id}
                      onClick={() => onMarkAsRead(notification.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-colors',
                        notification.read
                          ? 'bg-background border-border/50 opacity-70'
                          : 'bg-panel-secondary border-border hover:border-primary/50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('mt-0.5', config.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        ) : isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <RefreshCw className="h-10 w-10 text-muted-foreground/50 mb-4 animate-spin" />
            <p className="text-sm text-muted-foreground">Benachrichtigungen werden geladen</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Bitte warten...</p>
          </div>
        ) : errorMessage ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-destructive">
            <AlertTriangle className="h-10 w-10 mb-4" />
            <p className="text-sm">{errorMessage}</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              Keine Benachrichtigungen
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Sie sind auf dem neuesten Stand
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
