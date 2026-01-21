import { useState } from 'react';
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
import { Bell, FileText, AlertTriangle, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'report' | 'urgent' | 'system' | 'success';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'urgent',
    title: 'Dringender Report',
    message: 'MRT Schädel für Müller, Anna wartet auf Befundung.',
    time: 'vor 5 Min.',
    read: false,
  },
  {
    id: 'n2',
    type: 'report',
    title: 'Neuer Report in Queue',
    message: 'CT Thorax mit KM wurde der Warteschlange hinzugefügt.',
    time: 'vor 15 Min.',
    read: false,
  },
  {
    id: 'n3',
    type: 'success',
    title: 'Report freigegeben',
    message: 'Röntgen Thorax für Weber, Klaus wurde erfolgreich freigegeben.',
    time: 'vor 1 Std.',
    read: true,
  },
  {
    id: 'n4',
    type: 'system',
    title: 'System-Update',
    message: 'MedGemma v2.1.0 wurde installiert. Neue QA-Checks verfügbar.',
    time: 'vor 2 Std.',
    read: true,
  },
];

const typeConfig = {
  report: { icon: FileText, color: 'text-primary' },
  urgent: { icon: AlertTriangle, color: 'text-warning' },
  system: { icon: Clock, color: 'text-muted-foreground' },
  success: { icon: CheckCircle, color: 'text-success' },
};

export function NotificationsSheet({ open, onOpenChange }: NotificationsSheetProps) {
  const [notifications, setNotifications] = useState(mockNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

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
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="text-xs"
              >
                Alle als gelesen markieren
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Alle löschen
              </Button>
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-2 pb-4">
                {notifications.map((notification) => {
                  const config = typeConfig[notification.type];
                  const Icon = config.icon;

                  return (
                    <button
                      key={notification.id}
                      onClick={() => markAsRead(notification.id)}
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
