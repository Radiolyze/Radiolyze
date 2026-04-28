# Fehlerbehebung — Häufige Probleme für Radiologen

Diese Seite behandelt Probleme, die während der Befundungssitzung auftreten können, und was dagegen zu tun ist.
Für Infrastrukturprobleme wenden Sie sich an Ihren IT-Administrator.

---

## Studie nicht gefunden / lädt nicht

**Problem:** Eine Studie fehlt in der Arbeitsliste, oder ein Klick darauf bewirkt nichts.

**Schritte:**
1. 30–60 Sekunden warten und die Seite neu laden (`F5`). Studien benötigen nach dem Eintreffen im System manchmal einen Moment zur Indizierung.
2. Beim Technologen nachfragen, ob die Studie an das korrekte PACS (Orthanc) gesendet wurde.
3. Den Administrator bitten, im Orthanc Web-UI (`http://<Server>:8042`) zu prüfen, ob die Studie angekommen ist.

**Wenn Bilder laden, aber leer oder verzerrt erscheinen:**
- Anderen Browser versuchen (Chrome oder Firefox funktionieren am besten).
- Administrator bitten, die DICOMweb-Verbindung zu prüfen.

---

## Sprachdiktat (ASR) funktioniert nicht

**Problem:** Klick auf das Mikrofon bewirkt nichts, oder die Transkription bleibt leer.

**Der Reihe nach prüfen:**
1. **Browser-Mikrofon-Berechtigung** — Mikrofon-Symbol in der Browser-Adressleiste suchen; klicken und Zugriff erlauben.
2. **Richtiges Mikrofon ausgewählt** — in den OS-Soundeinstellungen prüfen, ob das Diktiermikrofon als Standard-Eingang gesetzt ist.
3. **ASR-Dienst läuft** — Administrator fragen, ob der ASR-Dienst (MedASR oder Whisper) aktiv ist.
4. **Netzwerk/Proxy-Problem** — wenn das Krankenhausnetzwerk einen Proxy verwendet, können WebSocket-Verbindungen für Echtzeit-ASR blockiert sein.

**Schlechte Transkriptionsqualität:**
- In normalem Tempo sprechen — zu schnell oder zu langsam reduziert die Genauigkeit.
- Headset oder Nahbesprechungsmikrofon statt eingebautem Laptop-Mikrofon verwenden.
- Hintergrundgeräusche reduzieren.
- Medizinisches ASR ist auf Standardterminologie optimiert — starke Abkürzungen oder lokalen Jargon vermeiden.

---

## KI generiert keine Impression

**Problem:** Klick auf „Impression generieren" liefert keine Ausgabe oder eine Fehlermeldung.

| Meldung | Wahrscheinliche Ursache |
|---|---|
| „KI-Dienst nicht verfügbar" | Kein GPU-Overlay konfiguriert oder vLLM-Dienst ausgefallen |
| „Timeout" | KI-Verarbeitung dauerte zu lang (große Studie oder überlastete GPU) |
| „Mock-Antwort" | CPU-only-Modus — KI ist deaktiviert, ein Platzhalter wird zurückgegeben |
| Keine Meldung, Ladekreis dreht sich weiter | Netzwerkverbindung prüfen; Seite neu laden |

**Was tun:**
- Im CPU-Modus oder ohne KI: Impression manuell schreiben.
- Administrator informieren, wenn KI vorher funktioniert hat und gestoppt ist.
- Befundung fortsetzen — KI-Unterstützung ist optional; manuelle Befundung ist immer möglich.

---

## Viewer-Probleme

**Problem:** Bilder erscheinen schwarz, verzerrt oder lassen sich nicht scrollen.

1. **Zuerst auf das Viewer-Panel klicken** — der Viewer benötigt Fokus, bevor Tastenkürzel und Scrollen funktionieren.
2. **Ansicht zurücksetzen** — `R` drücken.
3. **Fensterungs-Preset wechseln** — Preset klicken (Lunge, Knochen, Weichteile), wenn das Bild zu dunkel/hell ist.
4. **Studie neu laden** — andere Studie anklicken, dann zur ursprünglichen zurückkehren.
5. **Browser-Hard-Refresh** — `Ctrl + Shift + R` (Chrome/Firefox) zum Cache-Leeren.

**MPR- oder 3D-Ansicht nicht verfügbar:**
- MPR und VRT benötigen CT- oder MR-Studien mit volumetrischen Daten. Sie sind nicht für CXR oder unvollständige CT-Serien verfügbar.
- Administrator fragen, ob der Rekonstruktionsdienst läuft.

---

## Bericht wird nicht gespeichert

**Problem:** Nach „Freigeben" erscheint keine Bestätigung oder eine Fehlermeldung.

1. **Netzwerkverbindung prüfen** — das Backend muss erreichbar sein.
2. **Auf Validierungsfehler prüfen** — das Findings- oder Impression-Feld ist möglicherweise leer; das System erfordert mindestens minimalen Inhalt.
3. **Zuerst als Entwurf speichern** — `Ctrl + S` drücken, um zu testen, ob das Entwurf-Speichern funktioniert.
4. **Neu laden und nochmal versuchen** — wenn die Sitzung abgelaufen ist, Seite neu laden; der Entwurf ist möglicherweise im Browser erhalten.

---

## Performance: Langsames Laden / lange Wartezeiten

**Problem:** Studien brauchen lange zum Laden, oder der Viewer scrollt langsam.

- **Bild-Prefetch:** Das System lädt Serien automatisch vor, aber große CT/MR-Studien benötigen 30–60 Sekunden für vollständiges Laden. Teilweises Laden ist normal — Bilder erscheinen progressiv.
- **Browser-Hardware-Beschleunigung:** GPU-Beschleunigung im Browser aktivieren (Chrome: Einstellungen → System → Hardware-Beschleunigung verwenden).
- **Mehrere Tabs:** Nicht benötigte Browser-Tabs schließen, um Arbeitsspeicher freizugeben.
- **Große 3D-Rekonstruktionen:** VRT-Volumes sind GPU-intensiv. Wenn der 3D-Viewer langsam ist, auf MPR-Ansicht wechseln.

---

## Voruntersuchungen erscheinen nicht

**Problem:** Das Prior-Studies-Panel ist leer, obwohl frühere Studien bekannt sind.

- Voruntersuchungen werden anhand der Patienten-ID aus dem PACS abgeglichen. Wenn die Patienten-ID sich zwischen Studien unterscheidet (z.B. durch Namensänderung oder ID-Korrektur), schlägt das automatische Matching fehl.
- Administrator bitten zu prüfen, ob Voruntersuchungen in derselben Orthanc-Instanz gespeichert sind.
- Sie können jede Studie aus der Arbeitsliste manuell in einem zweiten Browser-Tab für manuellen Vergleich öffnen.

---

## Wann IT/Administrator kontaktieren

Den Administrator kontaktieren bei:

- ASR-Dienst dauerhaft ausgefallen
- KI-Modell nicht verfügbar
- Studien kommen nicht von der Modalität in der Arbeitsliste an
- Authentifizierungs- oder Anmeldeprobleme
- Datenschutzbedenken (PHI in Logs sichtbar, unerwartete Daten)

Bei der Fehlermeldung bitte angeben:
- Zeitpunkt des Problems
- Studien-UID oder Patienten-ID (ohne vollständigen Patientennamen in E-Mails)
- Browser-Name und -Version
- Screenshot der Fehlermeldung
