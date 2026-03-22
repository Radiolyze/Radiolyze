import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, MessageSquare, CheckCircle, XCircle, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface PeerReview {
  id: string;
  report_id: string;
  requested_by: string;
  assigned_to?: string;
  comment?: string;
  review_comment?: string;
  status: string;
  decision?: string;
  created_at: string;
  completed_at?: string;
}

interface PeerReviewDialogProps {
  reportId: string;
  reviews: PeerReview[];
  onRequestReview: (assignedTo: string | null, comment: string) => void;
  onSubmitReview?: (reviewId: string, comment: string, decision: 'agree' | 'disagree' | 'revise') => void;
}

const decisionConfig = {
  agree: { icon: CheckCircle, label: 'Zustimmung', color: 'text-green-400' },
  disagree: { icon: XCircle, label: 'Ablehnung', color: 'text-red-400' },
  revise: { icon: Edit3, label: 'Überarbeitung', color: 'text-yellow-400' },
};

export function PeerReviewDialog({ reportId, reviews, onRequestReview, onSubmitReview }: PeerReviewDialogProps) {
  const { t } = useTranslation('report');
  const [requestOpen, setRequestOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState<PeerReview | null>(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [comment, setComment] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [decision, setDecision] = useState<'agree' | 'disagree' | 'revise'>('agree');

  const pendingReviews = reviews.filter((r) => r.status === 'requested');
  const completedReviews = reviews.filter((r) => r.status === 'completed');

  const handleRequest = () => {
    onRequestReview(assignedTo || null, comment);
    setRequestOpen(false);
    setAssignedTo('');
    setComment('');
  };

  const handleSubmit = () => {
    if (submitOpen && onSubmitReview) {
      onSubmitReview(submitOpen.id, reviewComment, decision);
      setSubmitOpen(null);
      setReviewComment('');
      setDecision('agree');
    }
  };

  return (
    <div className="space-y-2">
      {/* Existing reviews summary */}
      {reviews.length > 0 && (
        <div className="rounded-lg border border-border/50 p-2 space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {t('peerReview.title', 'Zweitmeinungen')}
            </span>
            {pendingReviews.length > 0 && (
              <Badge variant="secondary" className="text-xs">{pendingReviews.length} offen</Badge>
            )}
          </div>
          {completedReviews.map((r) => {
            const cfg = decisionConfig[r.decision as keyof typeof decisionConfig] || decisionConfig.agree;
            const Icon = cfg.icon;
            return (
              <div key={r.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className={`h-3 w-3 ${cfg.color}`} />
                <span>{r.assigned_to || 'Reviewer'}: {cfg.label}</span>
                {r.review_comment && (
                  <span className="truncate max-w-[150px]" title={r.review_comment}>
                    — {r.review_comment}
                  </span>
                )}
              </div>
            );
          })}
          {pendingReviews.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{r.assigned_to || 'Unzugewiesen'}: ausstehend</span>
              {onSubmitReview && (
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setSubmitOpen(r)}>
                  Bewerten
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Request review button */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full text-xs">
            <Users className="h-3 w-3 mr-1" />
            {t('peerReview.request', 'Zweitmeinung anfordern')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('peerReview.requestTitle', 'Zweitmeinung anfordern')}</DialogTitle>
            <DialogDescription>
              {t('peerReview.requestDescription', 'Fordern Sie eine Zweitmeinung eines Kollegen für diesen Befund an.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder={t('peerReview.assignedToPlaceholder', 'Zuweisen an (optional)')}
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            />
            <Textarea
              placeholder={t('peerReview.commentPlaceholder', 'Fragestellung / Anmerkung...')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>
              {t('peerReview.cancel', 'Abbrechen')}
            </Button>
            <Button onClick={handleRequest}>
              {t('peerReview.submit', 'Anfordern')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit review dialog */}
      <Dialog open={!!submitOpen} onOpenChange={(open) => !open && setSubmitOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('peerReview.submitTitle', 'Zweitmeinung abgeben')}</DialogTitle>
          </DialogHeader>
          {submitOpen?.comment && (
            <div className="bg-muted/50 rounded p-2 text-sm">
              <MessageSquare className="h-3 w-3 inline mr-1" />
              {submitOpen.comment}
            </div>
          )}
          <div className="space-y-3 py-2">
            <Select value={decision} onValueChange={(v) => setDecision(v as typeof decision)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agree">Zustimmung</SelectItem>
                <SelectItem value="disagree">Ablehnung</SelectItem>
                <SelectItem value="revise">Überarbeitung empfohlen</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder={t('peerReview.reviewCommentPlaceholder', 'Kommentar zur Zweitmeinung...')}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(null)}>Abbrechen</Button>
            <Button onClick={handleSubmit} disabled={!reviewComment.trim()}>Absenden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
