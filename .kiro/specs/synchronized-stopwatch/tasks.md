# Implementation Plan: Synchronized Stopwatch

## Übersicht

Implementierung einer synchronisierten Stoppuhr-Website mit reinem HTML/CSS/JS-Frontend, Vercel Serverless Functions als Backend und Vercel KV (Upstash Redis) für persistenten Zustand. Die Umsetzung erfolgt in inkrementellen Schritten: Projektstruktur → Backend-API → Frontend → Fehlerbehandlung → Integration.

## Tasks

- [x] 1. Projektstruktur und Konfiguration aufsetzen
  - [x] 1.1 Projektdateien und Vercel-Konfiguration erstellen
    - Erstelle `package.json` mit `@vercel/kv` als Abhängigkeit
    - Erstelle `vercel.json` mit Rewrites-Konfiguration für API-Routen
    - Erstelle die Verzeichnisstruktur: `public/`, `api/`
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 2. Backend-API implementieren
  - [x] 2.1 GET-Endpunkt `api/state.js` implementieren
    - Implementiere den GET-Handler, der den Stoppuhr-Zustand aus Vercel KV liest
    - Implementiere Controller-Registrierung: Wenn `clientId` als Query-Parameter vorhanden, aktualisiere `controllerId` in KV
    - Gib den Zustand als JSON zurück inkl. `isController`-Feld (Vergleich clientId === controllerId)
    - Initialisiere Default-Zustand falls kein Eintrag in KV existiert: `{ running: false, startTime: null, elapsed: 0, controllerId: null }`
    - _Requirements: 2.4, 4.1, 4.2, 4.3, 5.1_

  - [x] 2.2 POST-Endpunkt `api/control.js` implementieren
    - Implementiere den POST-Handler, der `clientId` und `action` aus dem Request-Body liest
    - Prüfe ob der sendende Client der aktuelle Controller ist (403 wenn nicht)
    - Implementiere Start-Logik: Setze `running=true`, `startTime=Date.now()`
    - Implementiere Stop-Logik: Berechne neue `elapsed` als `elapsed + (Date.now() - startTime)`, setze `running=false`, `startTime=null`
    - Speichere aktualisierten Zustand in Vercel KV
    - _Requirements: 3.2, 3.3, 5.2, 5.3, 5.4_

  - [ ]* 2.3 Property-Tests für Backend-Logik schreiben
    - **Property 4: Start-Aktion setzt korrekten Zustand**
    - **Property 5: Stop-Aktion akkumuliert verstrichene Zeit**
    - **Property 6: Controller-Exklusivität**
    - **Property 7: Neuer Client wird Controller**
    - **Property 8: Controller-Information in Response**
    - **Property 10: KV-Fehler ergibt HTTP 500**
    - **Validates: Requirements 3.2, 3.3, 3.4, 4.1, 4.3, 5.3, 5.4, 7.2**

- [x] 3. Fehlerbehandlung im Backend
  - [x] 3.1 KV-Fehlerbehandlung in beiden Endpunkten ergänzen
    - Umschließe alle KV-Zugriffe in `api/state.js` und `api/control.js` mit try/catch
    - Gib HTTP 500 mit `{ success: false, error: "KV connection failed" }` bei KV-Fehlern zurück
    - _Requirements: 7.2_

- [x] 4. Checkpoint - Backend prüfen
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Frontend implementieren
  - [x] 5.1 HTML-Grundstruktur und Styling in `public/index.html` erstellen
    - Erstelle HTML-Dokument mit eingebettetem CSS
    - Implementiere dunklen Grau-Hintergrund (#1a1a2e)
    - Implementiere Zeitanzeige mit Türkis-Blauer Schriftfarbe (#00d4ff)
    - Erstelle Start/Stop-Button mit Styling
    - Erstelle Fehleranzeige-Element (initial versteckt)
    - _Requirements: 1.2, 1.3, 1.4, 3.1_

  - [x] 5.2 JavaScript-Logik im Frontend implementieren
    - Generiere UUID v4 als Client-ID beim Laden der Seite
    - Implementiere `formatTime(ms)`-Funktion für `MM:SS.ms`-Format
    - Implementiere Polling alle 500ms via `fetch('/api/state?clientId=...')`
    - Implementiere lokale Interpolation mit `requestAnimationFrame` für flüssige Anzeige
    - Implementiere Button-Aktivierung/Deaktivierung basierend auf `isController`
    - Implementiere Start/Stop-Button-Click-Handler mit `POST /api/control`
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 3.1, 3.4, 4.4_

  - [x] 5.3 Fehlerbehandlung im Frontend implementieren
    - Zeige Fehlermeldung bei fehlgeschlagenem Polling-Request
    - Behalte letzte bekannte Zeit bei Verbindungsproblemen bei
    - Verstecke Fehlermeldung wieder bei erfolgreicher Verbindung
    - _Requirements: 7.1_

  - [ ]* 5.4 Property-Tests für Frontend-Logik schreiben
    - **Property 1: Zeitformat-Konsistenz**
    - **Property 2: Zustandsübernahme bei Poll-Antwort**
    - **Property 3: Monotone Zeitanzeige bei laufender Stoppuhr**
    - **Property 9: Fehlerresilienz bei Verbindungsverlust**
    - **Validates: Requirements 1.1, 2.2, 2.3, 7.1**

- [x] 6. Integration und Abschluss
  - [x] 6.1 Gesamte Anwendung zusammenführen und finale Prüfung
    - Stelle sicher, dass Frontend korrekt auf Backend-Endpunkte zugreift
    - Prüfe, dass `vercel.json`-Routing korrekt konfiguriert ist
    - Verifiziere, dass alle Dateien an den richtigen Pfaden liegen
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 6.2 Integrationstests schreiben
    - Teste End-to-End-Flow: Client verbindet → wird Controller → startet/stoppt Stoppuhr
    - Teste Controller-Wechsel bei neuem Client
    - _Requirements: 4.1, 4.4, 5.3, 5.4_

- [x] 7. Finaler Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks mit `*` sind optional und können für ein schnelleres MVP übersprungen werden
- Jeder Task referenziert spezifische Requirements für Nachvollziehbarkeit
- Checkpoints stellen inkrementelle Validierung sicher
- Property-Tests validieren universelle Korrektheitseigenschaften aus dem Design
- Das Frontend ist eine einzelne HTML-Datei mit eingebettetem CSS und JS (kein Build-Step)
- Backend nutzt ausschließlich `@vercel/kv` als externe Abhängigkeit

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "3.1"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4", "6.1"] },
    { "id": 6, "tasks": ["6.2"] }
  ]
}
```
