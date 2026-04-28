# Security-Hardening

Erforderliche Schritte zur Absicherung einer Radiolyze-Installation für den Produktionsbetrieb.
Das Standard-Docker-Compose-Setup ist **nicht sicher** für klinische Umgebungen.

---

## Bedrohungsmodell

| Bedrohung | Auswirkung |
|---|---|
| Nicht authentifizierter UI-Zugriff | Beliebiger Benutzer kann Berichte lesen und freigeben |
| Standard-Zugangsdaten in Verwendung | Triviale Übernahme von Orthanc, Datenbank |
| Unverschlüsselter HTTP-Verkehr | Patientendaten und Zugangsdaten im Klartext übertragen |
| PHI in Logs | Datenschutzverletzung, Compliance-Verstoß |
| Uneingeschränkter Netzwerkzugriff | Laterale Bewegung im Krankenhausnetz |

---

## Schritt 1: Alle Standard-Zugangsdaten ändern

### Orthanc

`.env` bearbeiten:

```bash
VITE_DICOM_WEB_USERNAME=radiologie_benutzer
VITE_DICOM_WEB_PASSWORD=<generieren: openssl rand -base64 24>
```

Orthanc-Konfiguration mit passendem Passwort-Hash aktualisieren:

```json
{
  "AuthenticationEnabled": true,
  "RegisteredUsers": {
    "radiologie_benutzer": "ihr_bcrypt_gehashtes_passwort"
  }
}
```

### PostgreSQL

```bash
POSTGRES_PASSWORD=<generieren: openssl rand -base64 32>
```

### JWT-Signing-Secret

```bash
JWT_SECRET_KEY=<generieren: openssl rand -hex 32>
```

---

## Schritt 2: TLS aktivieren

Alle Verbindungen zur Radiolyze-UI und -API müssen in Produktion verschlüsselt sein.
Siehe [Deployment-Leitfaden — HTTPS hinzufügen](deployment.md#https-hinzufugen-nginx-reverse-proxy).

---

## Schritt 3: Netzwerk-Isolierung

Interne Dienste (PostgreSQL, Redis, Orthanc) dürfen nicht von außerhalb des Docker-Netzwerks erreichbar sein.

In `docker-compose.yml` prüfen, dass diese Dienste **keine** `ports:`-Einträge haben, die nach außen exponieren.

Firewall-Regeln (UFW-Beispiel):

```bash
sudo ufw default deny incoming
sudo ufw allow from <client_subnetz> to any port 443 proto tcp
sudo ufw allow from <modalitaeten_subnetz> to any port 4242 proto tcp
sudo ufw allow from <admin_ips> to any port 22 proto tcp
sudo ufw enable
```

---

## Schritt 4: PHI in Logs deaktivieren

```bash
# Backend-Logs auf Patientendaten prüfen:
docker compose logs backend | grep -i "patient\|name\|geburt" | head -20
```

---

## Schritt 5: Rate-Limiting

```nginx
http {
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    server {
        location /api/v1/auth/ {
            limit_req zone=login burst=3 nodelay;
        }
        location /api/ {
            limit_req zone=api burst=50 nodelay;
        }
    }
}
```

---

## Schritt 6: Upload-Größenlimits

```nginx
client_max_body_size 500M;   # An größte erwartete Studiengröße anpassen
```

---

## Schritt 7: Secret-Rotationsplan

| Secret | Rotationsintervall |
|---|---|
| JWT-Signing-Key | 90 Tage oder bei Personalwechsel |
| Orthanc-Passwort | 90 Tage oder bei Personalwechsel |
| PostgreSQL-Passwort | 180 Tage |
| Backup-Verschlüsselungsschlüssel | 180 Tage |

---

## Schritt 8: Audit-Log-Zugriff beschränken

```nginx
location /api/v1/audit {
    allow <compliance_office_ip>;
    deny all;
    proxy_pass http://localhost:8000;
}
```

---

## Schritt 9: Dependency- und Image-Scanning

```bash
docker scout cves radiolyze-backend
docker scout cves radiolyze-frontend

pip install safety
safety check -r backend/requirements.txt

npm audit
```

---

## Produktions-Security-Checkliste

- [ ] Alle Standard-Zugangsdaten geändert (Orthanc, PostgreSQL, JWT)
- [ ] TLS mit gültigem Zertifikat aktiviert
- [ ] HSTS-Header aktiv
- [ ] HTTP → HTTPS-Redirect aktiv
- [ ] Interne Dienste nicht auf Host-Ports exponiert
- [ ] Firewall-Regeln angewendet und getestet
- [ ] PHI erscheint nicht in Anwendungs-Logs
- [ ] Rate-Limiting in NGINX konfiguriert
- [ ] Upload-Größenlimits gesetzt
- [ ] Secret-Rotationsplan dokumentiert
- [ ] Audit-Log-Endpoint-Zugriff beschränkt
- [ ] Dependency-Scan in CI integriert
- [ ] Penetrationstest abgeschlossen (vor Go-Live)
- [ ] Backup-Verschlüsselung aktiviert
