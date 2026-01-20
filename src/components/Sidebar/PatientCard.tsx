import { User, Calendar, Hash, Stethoscope } from 'lucide-react';
import type { Patient, Study } from '@/types/radiology';
import { getAge, formatDate } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';

interface PatientCardProps {
  patient: Patient;
  study: Study;
}

export function PatientCard({ patient, study }: PatientCardProps) {
  const age = getAge(patient.dateOfBirth);

  return (
    <div className="p-4 border-b border-sidebar-border">
      {/* Patient Name */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{patient.name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{age !== null ? `${age} Jahre` : '—'}</span>
            <span>•</span>
            <span>{patient.gender === 'M' ? 'Männlich' : patient.gender === 'F' ? 'Weiblich' : 'Divers'}</span>
          </div>
        </div>
      </div>

      {/* Patient Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Hash className="h-4 w-4" />
          <span className="truncate">{patient.mrn}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(patient.dateOfBirth)}</span>
        </div>
      </div>

      {/* Current Study Info */}
      <div className="mt-4 p-3 bg-sidebar-accent rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
            {study.modality}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDate(study.studyDate)}</span>
        </div>
        <p className="text-sm font-medium text-foreground">{study.studyDescription}</p>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Stethoscope className="h-3 w-3" />
          <span>{study.referringPhysician}</span>
        </div>
      </div>
    </div>
  );
}
