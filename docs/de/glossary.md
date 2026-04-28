# Glossar

Definitionen der in der Radiolyze-Dokumentation verwendeten Begriffe. Nach Themenbereich gruppiert.

---

## Regulatorisch & Compliance

**Annex IV** — Die technische Dokumentationsstruktur, die die EU-KI-Verordnung für Hochrisiko-KI-Systeme vorschreibt. Legt fest, was dokumentiert werden muss: Systembeschreibung, Architektur, Risikoanalyse, Leistungsmetriken, Cybersicherheit und mehr.

**CE-Kennzeichnung** — Eine Erklärung des Herstellers, dass ein Produkt die EU-Regulierungsanforderungen erfüllt (MDR für Medizinprodukte, EU-KI-Verordnung für Hochrisiko-KI-Systeme). Die CE-Kennzeichnung erlaubt das Inverkehrbringen auf dem EU-Markt.

**Konformitätsbewertung** — Das Verfahren zum Nachweis, dass ein Produkt die anwendbaren Regulierungsanforderungen erfüllt. Für Hochrisiko-KI-Systeme durch Selbstbewertung oder Prüfung durch eine Benannte Stelle.

**AV-Vertrag (Auftragsverarbeitungsvertrag)** — Ein gemäß DSGVO erforderlicher Vertrag zwischen Verantwortlichem und Auftragsverarbeitern, die personenbezogene Daten verarbeiten. Erforderlich für Drittanbieter-Dienste mit Patientendaten.

**DSB (Datenschutzbeauftragter)** — Eine gemäß DSGVO bestellte Person zur Überwachung der Datenschutz-Compliance. Erforderlich für Organisationen, die systematisch besondere Kategorien personenbezogener Daten (wie Gesundheitsdaten) in großem Umfang verarbeiten.

**EU-KI-Verordnung** — Verordnung (EU) 2024/1689 über künstliche Intelligenz, die risikobasierte Anforderungen an KI-Systeme festlegt. Radiolyze ist als Hochrisiko-KI-System unter Anhang III eingestuft (medizinische KI in der klinischen Entscheidungsunterstützung).

**FMEA (Fehlermöglichkeits- und Einflussanalyse)** — Eine systematische Methode zur Identifikation potenzieller Fehlermodi, ihrer Ursachen, Auswirkungen und Schwere. Erforderlich als Teil des ISO-14971-Risikomanagements.

**DSGVO (Datenschutz-Grundverordnung)** — EU-Verordnung 2016/679 zum Schutz personenbezogener Daten. Gesundheits-/medizinische Daten sind nach Art. 9 „besondere Kategorien personenbezogener Daten" — explizite Rechtsgrundlage für die Verarbeitung erforderlich.

**ISO 14971** — Internationaler Standard für die Anwendung des Risikomanagements bei Medizinprodukten. Definiert den Prozess: Risikoanalyse → Risikobewertung → Risikokontrolle → Restrisiko-Bewertung → Überwachung nach der Produktion.

**MDR (Medizinprodukteverordnung)** — EU-Verordnung 2017/745 über Medizinprodukte. KI-gestützte klinische Entscheidungsunterstützungssysteme können als Medizinprodukte qualifizieren.

**Benannte Stelle** — Eine von einem EU-Mitgliedstaat anerkannte unabhängige Organisation zur Konformitätsbewertung regulierter Produkte (Medizinprodukte, Hochrisiko-KI-Systeme).

**RPZ (Risiko-Prioritätszahl)** — In FMEA: Schweregrad × Wahrscheinlichkeit. Zur Priorisierung der Risikoreduzierungsmaßnahmen. RPZ ≥ 16 ist im Radiolyze-Risikorahmen nicht akzeptabel.

**TOM (Technische und Organisatorische Maßnahme)** — Gemäß DSGVO Art. 32 erforderliche Sicherheits- und Datenschutzmaßnahmen. Umfasst technische (TLS, Verschlüsselung, Zugangskontrolle) und organisatorische Kontrollen (Schulung, Richtlinien, Verfahren).

---

## Klinisch & Radiologie

**DICOMweb** — HTTP-basierte API für Zugriff und Austausch von DICOM-Inhalten. Drei Dienste: QIDO-RS (Abfrage), WADO-RS (Abruf), STOW-RS (Speicherung). Radiolyze nutzt die DICOMweb-Implementierung von Orthanc.

**DICOM (Digital Imaging and Communications in Medicine)** — Der internationale Standard für medizinische Bilddaten: Dateiformat, Netzwerkprotokoll und Dienstklassen.

**DICOM SR (DICOM Structured Report)** — Standardisiertes Format zur Kodierung klinischer Befunde und Messungen innerhalb von DICOM. Radiolyze kann genehmigte Berichte als DICOM SR exportieren.

**KIS (Krankenhaus-Informationssystem)** — Das administrative System zur Verwaltung von Patientenaufnahmen, Entlassungen, klinischer Dokumentation und Abrechnung.

**Seitenangabe** — Die betroffene Körperseite (links, rechts, beidseits). Häufige Fehlerquelle bei KI; die Radiolyze-QA-Engine prüft auf Seitenangaben-Konsistenz.

**PACS (Picture Archiving and Communication System)** — Das Krankenhaus-System für Langzeitspeicherung, Abruf und Anzeige medizinischer Bilder. Orthanc fungiert als Mini-PACS in Radiolyze.

**PHI (Protected Health Information / Geschützte Gesundheitsinformation)** — Alle individuell identifizierbaren Gesundheitsinformationen: Patientenname, Geburtsdatum, Krankenaktennummer, Untersuchungsdatum, Diagnosen, Bilder. PHI darf nicht in Anwendungs-Logs erscheinen.

**RECIST (Response Evaluation Criteria in Solid Tumours)** — Standardisierte Kriterien zur Messung des Tumoransprechens auf Behandlung mittels Bildgebung. Radiolyze unterstützt Läsionsmessungs-Annotationen im DICOM-Viewer.

**RIS (Radiologie-Informationssystem)** — Das System zur Verwaltung des Radiologie-Abteilungs-Workflows: Terminplanung, Arbeitslisten, Auftragsmanagement, Berichtsverteilung.

**W/L (Fensterbreite / Fensterlage)** — Auch „Fensterung". Eine Anzeigetechnik, die einen Bereich von Hounsfield-Einheiten (HU) auf den Graustufen-Anzeigebereich abbildet. Beispiele: Lungenfenster (W:1500/L:-600), Knochenfenster (W:2000/L:400).

**Arbeitsliste (DICOM Modality Worklist)** — Ein DICOM-Dienst, der geplante Verfahrensinformationen (Patientendemografie, Studieninformationen) vom RIS zu Bildgebungsmodalitäten überträgt.

---

## Technisch

**ASR (Automatische Spracherkennung)** — Software, die gesprochenes Diktat in Text umwandelt. Radiolyze unterstützt zwei ASR-Anbieter: MedASR (lokal, medizinisches Vokabular) und Whisper (OpenAIs Open-Source-ASR). Diktat-Audio wird im Speicher verarbeitet; nur ein Hash wird im Audit-Log gespeichert.

**Audit-Event** — Ein strukturierter Datensatz, der in die PostgreSQL-Tabelle `audit_events` geschrieben wird, wenn eine bedeutende Aktion erfolgt. Enthält event_type, actor_id, study_id, timestamp, model_version und input_hash. Kein rohes PHI.

**Drift-Monitoring** — Laufende Messung der KI-Output-Qualitätsmetriken über die Zeit zur Erkennung von Qualitätsverschlechterung. Radiolyze exponiert `/api/v1/monitoring/drift`.

**Docker Compose** — Das Container-Orchestrierungswerkzeug zum Betrieb aller Radiolyze-Dienste als koordinierten Stack. Overlay-Dateien (`gpu.yml`, `rocm.yml`, `whisper.yml`) erweitern die Basiskonfiguration.

**Guided JSON** — Eine vLLM-Funktion, die die Modell-Ausgabe auf ein festgelegtes JSON-Schema mittels grammatikbasiertem Sampling beschränkt. Wird in Radiolyze verwendet um sicherzustellen, dass MedGemma immer eine gültige strukturierte Antwort ausgibt.

**JWT (JSON Web Token)** — Das in Radiolyze verwendete Authentifizierungs-Token-Format. Das Backend stellt bei Anmeldung signierte JWTs aus; alle API-Anfragen enthalten das Token im `Authorization: Bearer`-Header.

**MedGemma** — Das in Radiolyze verwendete multimodale KI-Modell für radiologische Impressions-Generierung. Architektur: Gemma-2-Sprachbasis + SigLIP-Vision-Encoder. Von Google DeepMind veröffentlicht.

**MPR (Multi-Planare Rekonstruktion)** — Eine Viewer-Technik zur Generierung axialer, koronaler und sagittaler Schnitte aus volumetrischen CT/MR-Daten.

**QA (Qualitätssicherung)** — Automatisierte Prüfungen auf radiologischen Berichten vor der Freigabe. Aktuelle Regeln: Seitenangaben-Konsistenz, Pflichtabschnitt-Vollständigkeit, Platzhaltertext-Erkennung.

**RAG (Retrieval Augmented Generation)** — Eine KI-Technik, die ein Sprachmodell mit einem Retrieval-System kombiniert, um Antworten in externem Wissen zu verankern (z.B. klinische Leitlinien).

**RBAC (Rollenbasierte Zugangskontrolle)** — Zugangskontrollmodell, bei dem Berechtigungen Rollen (Radiologe, QA, Admin) zugewiesen und Benutzer Rollen zugeordnet werden.

**Redis** — Ein In-Memory-Datenspeicher, der in Radiolyze als Message Broker für die RQ-Aufgabenwarteschlange dient.

**RQ (Redis Queue)** — Eine Python-Aufgabenwarteschlange auf Basis von Redis. Wird in Radiolyze für asynchrone KI-Inferenz-Jobs verwendet.

**SigLIP** — Ein von Google entwickelter Vision-Language-Encoder, der als Bildverarbeitungskomponente von MedGemma dient. Verarbeitet Bilder bis 896×896 Pixel.

**vLLM** — Ein Open-Source-GPU-beschleunigter Inferenz-Server für große Sprachmodelle mit OpenAI-kompatibler API. Dient zum Betrieb von MedGemma in Radiolyze.

**VRT / 3D-Rendering** — Volume Rendering Technique. Ein Viewer-Modus, der eine 3D-Visualisierung aus volumetrischen CT/MR-Daten generiert. Verfügbar mit Presets: Angio, Knochen, Lunge, Weichteile, Kardial.

---

## Abkürzungsreferenz

| Abkürzung | Vollform |
|---|---|
| ASR | Automatische Spracherkennung (Automatic Speech Recognition) |
| AV-Vertrag | Auftragsverarbeitungsvertrag |
| DICOM | Digital Imaging and Communications in Medicine |
| DSB | Datenschutzbeauftragter |
| DSGVO | Datenschutz-Grundverordnung |
| FMEA | Fehlermöglichkeits- und Einflussanalyse |
| ISO | Internationale Organisation für Normung |
| JWT | JSON Web Token |
| KIS | Krankenhaus-Informationssystem |
| MDR | Medizinprodukteverordnung (EU 2017/745) |
| MPR | Multi-Planare Rekonstruktion |
| PACS | Picture Archiving and Communication System |
| PHI | Geschützte Gesundheitsinformation |
| QA | Qualitätssicherung |
| RAG | Retrieval Augmented Generation |
| RBAC | Rollenbasierte Zugangskontrolle |
| RECIST | Response Evaluation Criteria in Solid Tumours |
| RIS | Radiologie-Informationssystem |
| RPZ | Risiko-Prioritätszahl |
| RQ | Redis Queue |
| SR | Strukturierter Bericht (DICOM) |
| TLS | Transport Layer Security |
| TOM | Technische und Organisatorische Maßnahme |
| VRT | Volume Rendering Technique |
| W/L | Fensterbreite / Fensterlage |
