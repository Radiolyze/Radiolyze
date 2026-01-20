import type { Patient, Study, Series, Report, QueueItem, ReportTemplate, Guideline } from '@/types/radiology';

// Mock Patients
export const mockPatients: Patient[] = [
  {
    id: 'p1',
    name: 'Schmidt, Hans',
    dateOfBirth: '1958-03-15',
    gender: 'M',
    mrn: 'MRN-2024-001234',
  },
  {
    id: 'p2',
    name: 'Müller, Anna',
    dateOfBirth: '1972-08-22',
    gender: 'F',
    mrn: 'MRN-2024-001235',
  },
  {
    id: 'p3',
    name: 'Weber, Klaus',
    dateOfBirth: '1965-11-08',
    gender: 'M',
    mrn: 'MRN-2024-001236',
  },
];

// Mock Series
export const mockSeries: Series[] = [
  {
    id: 's1',
    studyId: 'st1',
    seriesNumber: 1,
    seriesDescription: 'Axial',
    modality: 'CT',
    frameCount: 120,
  },
  {
    id: 's2',
    studyId: 'st1',
    seriesNumber: 2,
    seriesDescription: 'Coronal',
    modality: 'CT',
    frameCount: 80,
  },
  {
    id: 's3',
    studyId: 'st1',
    seriesNumber: 3,
    seriesDescription: 'Sagittal',
    modality: 'CT',
    frameCount: 60,
  },
];

// Mock Studies
export const mockStudies: Study[] = [
  {
    id: 'st1',
    patientId: 'p1',
    accessionNumber: 'ACC-2024-00001',
    modality: 'CT',
    studyDate: '2024-01-19',
    studyDescription: 'CT Thorax mit KM',
    referringPhysician: 'Dr. Meier',
    series: mockSeries,
  },
  {
    id: 'st2',
    patientId: 'p2',
    accessionNumber: 'ACC-2024-00002',
    modality: 'MR',
    studyDate: '2024-01-19',
    studyDescription: 'MRT Schädel',
    referringPhysician: 'Dr. Fischer',
    series: [
      {
        id: 's4',
        studyId: 'st2',
        seriesNumber: 1,
        seriesDescription: 'T1 Axial',
        modality: 'MR',
        frameCount: 24,
      },
      {
        id: 's5',
        studyId: 'st2',
        seriesNumber: 2,
        seriesDescription: 'T2 FLAIR',
        modality: 'MR',
        frameCount: 24,
      },
    ],
  },
  {
    id: 'st3',
    patientId: 'p3',
    accessionNumber: 'ACC-2024-00003',
    modality: 'CR',
    studyDate: '2024-01-19',
    studyDescription: 'Röntgen Thorax',
    referringPhysician: 'Dr. Schulz',
    series: [
      {
        id: 's6',
        studyId: 'st3',
        seriesNumber: 1,
        seriesDescription: 'PA',
        modality: 'CR',
        frameCount: 1,
      },
    ],
  },
];

// Mock Reports
export const mockReports: Report[] = [
  {
    id: 'r1',
    studyId: 'st1',
    patientId: 'p1',
    status: 'in_progress',
    findingsText: '',
    impressionText: '',
    createdAt: '2024-01-19T08:30:00Z',
    updatedAt: '2024-01-19T08:30:00Z',
    qaStatus: 'pending',
    qaWarnings: [],
  },
  {
    id: 'r2',
    studyId: 'st2',
    patientId: 'p2',
    status: 'pending',
    findingsText: '',
    impressionText: '',
    createdAt: '2024-01-19T09:15:00Z',
    updatedAt: '2024-01-19T09:15:00Z',
    qaStatus: 'pending',
    qaWarnings: [],
  },
  {
    id: 'r3',
    studyId: 'st3',
    patientId: 'p3',
    status: 'approved',
    findingsText: 'Herzgröße und -konfiguration normal. Keine Stauungszeichen. Keine Infiltrate. Keine Pleuraergüsse.',
    impressionText: 'Unauffälliger Röntgen-Thorax.',
    createdAt: '2024-01-19T07:45:00Z',
    updatedAt: '2024-01-19T08:00:00Z',
    approvedAt: '2024-01-19T08:00:00Z',
    approvedBy: 'Dr. Radiologe',
    qaStatus: 'pass',
    qaWarnings: [],
  },
];

// Mock Queue Items
export const mockQueueItems: QueueItem[] = [
  {
    id: 'q1',
    patient: mockPatients[0],
    study: mockStudies[0],
    report: mockReports[0],
    priority: 'normal',
  },
  {
    id: 'q2',
    patient: mockPatients[1],
    study: mockStudies[1],
    report: mockReports[1],
    priority: 'urgent',
  },
  {
    id: 'q3',
    patient: mockPatients[2],
    study: mockStudies[2],
    report: mockReports[2],
    priority: 'normal',
  },
];

// Mock ASR Transcripts (simulated dictation results)
export const mockASRTranscripts = [
  'Im CT Thorax mit Kontrastmittel zeigt sich ein 2,3 cm messender Rundherd im rechten Oberlappen.',
  'Die mediastinalen Lymphknoten sind unauffällig, kein Nachweis von pathologisch vergrößerten Lymphknoten.',
  'Kein Pleuraerguss beidseits. Die Herzsilhouette ist normal konfiguriert.',
  'Im Vergleich zur Voruntersuchung vom 15.07.2023 zeigt sich eine Größenprogredienz des bekannten Rundherdes.',
];

// Mock AI Impressions (simulated AI-generated text)
export const mockAIImpressions = [
  '1. Solitärer pulmonaler Rundherd rechter Oberlappen (2,3 cm), größenprogredient im Vergleich zur Voruntersuchung. Verdacht auf malignes Geschehen. Empfehlung: PET-CT zur weiteren Abklärung.\n\n2. Keine mediastinale Lymphadenopathie.\n\n3. Kein Pleuraerguss.',
  'Unauffälliger MRT-Befund des Schädels. Keine Raumforderung, keine Blutung, keine Ischämie.',
  'Unauffälliger Röntgen-Thorax ohne Nachweis von Infiltraten oder Ergüssen.',
];

// Mock QA Checks
export const mockQAChecks = [
  { id: 'qa1', name: 'Findings vorhanden', status: 'pass' as const },
  { id: 'qa2', name: 'Impression vorhanden', status: 'pass' as const },
  { id: 'qa3', name: 'Lateralität angegeben', status: 'pass' as const },
  { id: 'qa4', name: 'Größenangabe bei Läsionen', status: 'warn' as const, message: 'Empfehlung: Größe in 3 Dimensionen angeben' },
  { id: 'qa5', name: 'Vergleich mit Voruntersuchung', status: 'pass' as const },
  { id: 'qa6', name: 'Fleischner-Kriterien angewandt', status: 'warn' as const, message: 'Bei Lungenrundherd >8mm: Follow-up Empfehlung prüfen' },
];

// Mock Report Templates
export const mockTemplates: ReportTemplate[] = [
  {
    id: 'tpl-ct-thorax',
    name: 'CT Thorax Standard',
    modality: 'CT',
    description: 'Standardstruktur fuer CT Thorax mit KM.',
    sections: ['Indikation', 'Technik', 'Befund', 'Beurteilung', 'Empfehlung'],
    lastUpdated: '2024-01-05',
  },
  {
    id: 'tpl-mr-brain',
    name: 'MRT Schaedel Standard',
    modality: 'MR',
    description: 'Standardstruktur fuer MRT des Schaedels.',
    sections: ['Indikation', 'Sequenzen', 'Befund', 'Beurteilung'],
    lastUpdated: '2024-01-07',
  },
  {
    id: 'tpl-cr-cxr',
    name: 'Roentgen Thorax',
    modality: 'CR',
    description: 'Kurzbefund fuer CXR (PA/lat).',
    sections: ['Indikation', 'Befund', 'Beurteilung'],
    lastUpdated: '2024-01-02',
  },
];

// Mock Guidelines
export const mockGuidelines: Guideline[] = [
  {
    id: 'gl-fleischner-2017',
    title: 'Fleischner 2017 Pulmonary Nodule',
    category: 'CT Thorax',
    summary: 'Follow-up Intervalle nach Groesse und Risiko.',
    status: 'warn',
    source: 'Fleischner',
  },
  {
    id: 'gl-acr-incidentals',
    title: 'ACR Incidental Findings',
    category: 'CT Abdomen',
    summary: 'Empfehlungen fuer Zufallsbefunde.',
    status: 'info',
    source: 'ACR',
  },
  {
    id: 'gl-rsna-lung-rads',
    title: 'Lung-RADS',
    category: 'CT Screening',
    summary: 'Klassifikation fuer Lungen-Screening.',
    status: 'pass',
    source: 'RSNA',
  },
];

// Helper function to get age from date of birth
export function getAge(dateOfBirth: string): number | null {
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Helper to format date
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Helper to format time
export function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
