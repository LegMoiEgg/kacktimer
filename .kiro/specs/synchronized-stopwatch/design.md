# Design Document

## Architektur-Übersicht

Die Anwendung folgt einer klassischen Client-Server-Architektur mit Polling-basierter Synchronisation:

```
┌─────────────────┐         ┌──────────────────────┐         ┌────────────┐
│  Browser-Client │◄──500ms──►  Vercel Serverless   │◄────────►  Vercel KV  │
│  (HTML/CSS/JS)  │  Polling │  Functions (Node.js) │          │  (Redis)   │
└─────────────────┘         └──────────────────────┘         └────────────┘
```

- **Frontend**: Statische HTML/CSS/JS-Dateien im `public/`-Verzeichnis
- **Backend**: Vercel Serverless Functions im `api/`-Verzeichnis
- **State Storage**: Vercel KV (Upstash Redis) für persistenten Zustand

## Komponenten

### 1. Frontend (`public/index.html`)

Eine einzelne HTML-Datei mit eingebettetem CSS und JavaScript:

- **Anzeige-Komponente**: Rendert die Zeit im Format `MM:SS.ms`
- **Steuerungs-Komponente**: Start/Stop-Button mit Aktivierungslogik
- **Polling-Modul**: Ruft alle 500ms den Backend-Status ab
- **Interpolations-Modul**: Zählt die Zeit lokal weiter zwischen Polls
- **Fehleranzeige**: Zeigt Verbindungsprobleme an

### 2. Backend-API (`api/`)

#### `api/state.js` — GET-Endpunkt

Gibt den aktuellen Stoppuhr-Zustand zurück.

#### `api/control.js` — POST-Endpunkt

Nimmt Start/Stop-Aktionen entgegen und prüft die Controller-Berechtigung.

### 3. State-Management (Vercel KV)

Ein einzelner KV-Key `stopwatch` speichert den gesamten Zustand als JSON.

## Schnittstellen

### GET `/api/state`

**Query-Parameter:**
| Parameter | Typ    | Beschreibung                    |
|-----------|--------|---------------------------------|
| clientId  | string | Eindeutige ID des anfragenden Clients |

**Response (200):**
```json
{
  "running": true,
  "startTime": 1700000000000,
  "elapsed": 0,
  "controllerId": "abc-123",
  "isController": true
}
```

| Feld         | Typ     | Beschreibung                                           |
|--------------|---------|--------------------------------------------------------|
| running      | boolean | Ob die Stoppuhr aktuell läuft                         |
| startTime    | number  | Unix-Timestamp (ms) wann die Stoppuhr gestartet wurde |
| elapsed      | number  | Gespeicherte verstrichene Zeit in ms (bei Stop)       |
| controllerId | string  | Client-ID des aktuellen Controllers                   |
| isController | boolean | Ob der anfragende Client der Controller ist           |

**Seiteneffekt:** Wenn der `clientId`-Parameter vorhanden ist, wird dieser Client als neuer Controller registriert.

### POST `/api/control`

**Request-Body:**
```json
{
  "clientId": "abc-123",
  "action": "start"
}
```

| Feld     | Typ    | Beschreibung                     |
|----------|--------|----------------------------------|
| clientId | string | Client-ID des sendenden Clients |
| action   | string | `"start"` oder `"stop"`         |

**Response (200) — Erfolg:**
```json
{
  "success": true,
  "state": { "running": true, "startTime": 1700000000000, "elapsed": 0 }
}
```

**Response (403) — Nicht autorisiert:**
```json
{
  "success": false,
  "error": "Not the current controller"
}
```

**Response (500) — Server-Fehler:**
```json
{
  "success": false,
  "error": "KV connection failed"
}
```

## Datenmodell

### Vercel KV — Key `stopwatch`

```json
{
  "running": false,
  "startTime": null,
  "elapsed": 0,
  "controllerId": null
}
```

| Feld         | Typ           | Beschreibung                                        |
|--------------|---------------|-----------------------------------------------------|
| running      | boolean       | Ob die Stoppuhr aktuell läuft                      |
| startTime    | number\|null  | Unix-Timestamp (ms) des Starts, null wenn gestoppt |
| elapsed      | number        | Akkumulierte Zeit in ms vor dem letzten Start      |
| controllerId | string\|null  | Client-ID des aktuellen Controllers                |

### Client-ID Generierung

Jeder Browser-Tab generiert beim Laden eine UUID v4 als Client-ID, die für die gesamte Sitzung bestehen bleibt.

## Zeitberechnung

### Im Backend (bei GET `/api/state`)

Die tatsächlich verstrichene Zeit wird nicht explizit berechnet — das Frontend berechnet sie selbst:

- **Stoppuhr läuft:** `displayTime = elapsed + (Date.now() - startTime)`
- **Stoppuhr gestoppt:** `displayTime = elapsed`

### Im Frontend (Interpolation)

Zwischen den 500ms-Polling-Intervallen zählt ein lokaler `requestAnimationFrame`-Loop die Zeit weiter:

```javascript
function updateDisplay() {
  if (state.running) {
    const now = Date.now();
    const displayTime = state.elapsed + (now - state.startTime);
    renderTime(displayTime);
  }
  requestAnimationFrame(updateDisplay);
}
```

### Zeitformat-Funktion

```javascript
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
}
```

## Steuerungslogik

### Start-Aktion (Backend)

```javascript
// api/control.js — Start-Logik
const state = await kv.get('stopwatch');
if (body.clientId !== state.controllerId) {
  return res.status(403).json({ success: false, error: 'Not the current controller' });
}
state.running = true;
state.startTime = Date.now();
await kv.set('stopwatch', state);
```

### Stop-Aktion (Backend)

```javascript
// api/control.js — Stop-Logik
const state = await kv.get('stopwatch');
if (body.clientId !== state.controllerId) {
  return res.status(403).json({ success: false, error: 'Not the current controller' });
}
state.elapsed = state.elapsed + (Date.now() - state.startTime);
state.running = false;
state.startTime = null;
await kv.set('stopwatch', state);
```

### Controller-Registrierung (Backend)

```javascript
// api/state.js — Controller-Registrierung bei jedem Poll
const state = await kv.get('stopwatch') || { running: false, startTime: null, elapsed: 0, controllerId: null };
if (clientId) {
  state.controllerId = clientId;
  await kv.set('stopwatch', state);
}
```

## Fehlerbehandlung

### Frontend — Verbindungsfehler

```javascript
async function pollState() {
  try {
    const response = await fetch(`/api/state?clientId=${clientId}`);
    if (!response.ok) throw new Error('Server error');
    const data = await response.json();
    updateState(data);
    hideError();
  } catch (error) {
    showError('Verbindung unterbrochen');
    // Letzte bekannte Zeit wird weiter angezeigt
  }
}
```

### Backend — KV-Fehler

```javascript
try {
  const state = await kv.get('stopwatch');
  // ...
} catch (error) {
  return res.status(500).json({ success: false, error: 'KV connection failed' });
}
```

## Projektstruktur

```
/
├── public/
│   └── index.html          # Frontend (HTML + eingebettetes CSS/JS)
├── api/
│   ├── state.js            # GET — Zustand abfragen + Controller registrieren
│   └── control.js          # POST — Start/Stop-Aktionen
├── vercel.json             # Vercel-Konfiguration
└── package.json            # Abhängigkeiten (nur @vercel/kv)
```

## Vercel-Konfiguration

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" }
  ]
}
```

## Correctness Properties

*Eine Eigenschaft (Property) ist ein Verhalten, das für alle gültigen Eingaben gelten muss — eine formale Aussage darüber, was das System tun soll. Properties dienen als Brücke zwischen menschlich lesbaren Spezifikationen und maschinenverifizierbaren Korrektheitszusicherungen.*

### Property 1: Zeitformat-Konsistenz

*Für jeden* nicht-negativen Millisekunden-Wert soll die `formatTime`-Funktion einen String im Format `MM:SS.ms` zurückgeben, wobei MM zweistellig (00-99+), SS zweistellig (00-59) und ms zweistellig (00-99) ist.

**Validates: Requirements 1.1**

### Property 2: Zustandsübernahme bei Poll-Antwort

*Für jede* gültige Server-Antwort (mit `running`, `startTime`, `elapsed`) soll das Frontend die angezeigte Zeit so berechnen, dass sie dem Serverzustand entspricht: Bei `running=true` als `elapsed + (now - startTime)`, bei `running=false` als `elapsed`.

**Validates: Requirements 2.2**

### Property 3: Monotone Zeitanzeige bei laufender Stoppuhr

*Für jede* laufende Stoppuhr (running=true) mit festem Startzustand soll die angezeigte Zeit zu jedem späteren Zeitpunkt t2 > t1 größer oder gleich der angezeigten Zeit zu t1 sein.

**Validates: Requirements 2.3**

### Property 4: Start-Aktion setzt korrekten Zustand

*Für jede* gültige Controller-ID, wenn eine Start-Aktion gesendet wird, soll der resultierende Zustand `running=true` haben und `startTime` auf einen Wert nahe `Date.now()` gesetzt sein.

**Validates: Requirements 3.2**

### Property 5: Stop-Aktion akkumuliert verstrichene Zeit

*Für jede* laufende Stoppuhr mit beliebiger Startzeit und vorheriger elapsed-Zeit, wenn eine Stop-Aktion ausgeführt wird, soll der resultierende Zustand `running=false` haben und `elapsed` die Summe aus vorheriger elapsed-Zeit und der Differenz `(stopTime - startTime)` sein.

**Validates: Requirements 3.3**

### Property 6: Controller-Exklusivität

*Für jede* Client-ID, die nicht der aktuellen Controller-ID entspricht, soll jede Start- oder Stop-Aktion mit HTTP 403 abgelehnt werden und der Stoppuhr-Zustand unverändert bleiben.

**Validates: Requirements 3.4, 4.4, 5.3, 5.4**

### Property 7: Neuer Client wird Controller

*Für jede* neue Client-ID, die sich über den GET-Endpunkt mit dem Backend verbindet, soll die `controllerId` im gespeicherten Zustand auf diese neue Client-ID aktualisiert werden.

**Validates: Requirements 4.1**

### Property 8: Controller-Information in Response

*Für jede* Abfrage mit einer Client-ID soll die Antwort ein boolesches Feld `isController` enthalten, das `true` ist wenn die anfragende Client-ID der gespeicherten Controller-ID entspricht, und `false` sonst.

**Validates: Requirements 4.3**

### Property 9: Fehlerresilienz bei Verbindungsverlust

*Für jeden* letzten bekannten Stoppuhr-Zustand, wenn ein Polling-Request fehlschlägt, soll das Frontend die zuletzt angezeigte Zeit beibehalten und einen sichtbaren Fehlerhinweis darstellen.

**Validates: Requirements 7.1**

### Property 10: KV-Fehler ergibt HTTP 500

*Für jede* beliebige Anfrage an das Backend, wenn die Verbindung zu Vercel KV fehlschlägt, soll das Backend HTTP 500 mit einem JSON-Body zurückgeben, der eine Fehlermeldung enthält.

**Validates: Requirements 7.2**
