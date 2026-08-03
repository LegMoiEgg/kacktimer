# Requirements Document

## Einleitung

Eine synchronisierte Stoppuhr-Website, die auf Vercel deployed wird. Mehrere Clients können die gleiche laufende Zeit sehen. Der zuletzt verbundene Client erhält die exklusive Kontrolle über Start und Stop. Der Zustand wird serverseitig in Vercel KV (Upstash Redis) gespeichert. Das Frontend ist reines HTML/CSS/JS ohne Framework oder Build-Step. Die Synchronisation erfolgt per Polling alle 500ms.

## Glossar

- **Stoppuhr-Frontend**: Die im Browser angezeigte HTML/CSS/JS-Anwendung, die den aktuellen Stoppuhr-Zustand darstellt und Steuerungselemente bereitstellt.
- **Stoppuhr-Backend**: Die Vercel Serverless Functions (Node.js), die den Stoppuhr-Zustand verwalten und API-Endpunkte bereitstellen.
- **Vercel KV**: Der Upstash-Redis-basierte Key-Value-Store, der den persistenten Stoppuhr-Zustand speichert.
- **Stoppuhr-Zustand**: Die gespeicherten Daten bestehend aus: Laufstatus (gestartet/gestoppt), Startzeit, verstrichene Zeit und aktuellem Controller.
- **Controller**: Der zuletzt verbundene Client, der die exklusive Berechtigung hat, die Stoppuhr zu starten und zu stoppen.
- **Client-ID**: Eine eindeutige Kennung, die jedem verbundenen Browser-Tab zugewiesen wird.

## Requirements

### Requirement 1: Stoppuhr-Anzeige

**User Story:** Als Benutzer möchte ich die aktuelle Stoppuhr-Zeit im Browser sehen, damit ich den Fortschritt verfolgen kann.

#### Acceptance Criteria

1. THE Stoppuhr-Frontend SHALL die verstrichene Zeit im Format MM:SS.ms (Minuten:Sekunden.Millisekunden) anzeigen.
2. THE Stoppuhr-Frontend SHALL einen dunklen Grau-Hintergrund (#1a1a2e oder vergleichbar) verwenden.
3. THE Stoppuhr-Frontend SHALL die Zeit in Türkis-Blauer Schriftfarbe (#00d4ff oder vergleichbar) darstellen.
4. THE Stoppuhr-Frontend SHALL ohne Build-Step oder Framework als reines HTML/CSS/JS ausgeliefert werden.

### Requirement 2: Synchronisation der Stoppuhr-Zeit

**User Story:** Als Benutzer möchte ich auf allen verbundenen Clients die gleiche Zeit sehen, damit alle Beteiligten synchron sind.

#### Acceptance Criteria

1. THE Stoppuhr-Frontend SHALL alle 500ms den aktuellen Stoppuhr-Zustand vom Stoppuhr-Backend abfragen.
2. WHEN das Stoppuhr-Frontend eine Antwort vom Stoppuhr-Backend erhält, THE Stoppuhr-Frontend SHALL die angezeigte Zeit basierend auf dem empfangenen Zustand aktualisieren.
3. WHILE die Stoppuhr gestartet ist, THE Stoppuhr-Frontend SHALL die angezeigte Zeit zwischen den Polling-Intervallen lokal interpolieren, um eine flüssige Anzeige zu gewährleisten.
4. THE Stoppuhr-Backend SHALL den Stoppuhr-Zustand in Vercel KV speichern.

### Requirement 3: Steuerung der Stoppuhr

**User Story:** Als Controller möchte ich die Stoppuhr starten und stoppen können, damit ich die Zeitmessung kontrollieren kann.

#### Acceptance Criteria

1. THE Stoppuhr-Frontend SHALL einen Start/Stop-Button anzeigen.
2. WHEN der Controller den Start-Button betätigt, THE Stoppuhr-Backend SHALL den Stoppuhr-Zustand auf "gestartet" setzen und die aktuelle Serverzeit als Startzeit speichern.
3. WHEN der Controller den Stop-Button betätigt, THE Stoppuhr-Backend SHALL den Stoppuhr-Zustand auf "gestoppt" setzen und die verstrichene Zeit speichern.
4. WHILE ein Client nicht der Controller ist, THE Stoppuhr-Frontend SHALL den Start/Stop-Button deaktiviert darstellen.

### Requirement 4: Controller-Zuweisung

**User Story:** Als zuletzt verbundener Benutzer möchte ich automatisch die Kontrolle über die Stoppuhr erhalten, damit klar ist, wer steuern darf.

#### Acceptance Criteria

1. WHEN ein neuer Client sich mit dem Stoppuhr-Backend verbindet, THE Stoppuhr-Backend SHALL diesen Client als neuen Controller registrieren.
2. THE Stoppuhr-Backend SHALL die Client-ID des aktuellen Controllers in Vercel KV speichern.
3. WHEN das Stoppuhr-Frontend den Stoppuhr-Zustand abfragt, THE Stoppuhr-Backend SHALL die Information mitliefern, ob der anfragende Client der aktuelle Controller ist.
4. WHEN ein anderer Client zum Controller wird, THE Stoppuhr-Frontend SHALL den Start/Stop-Button beim vorherigen Controller deaktivieren.

### Requirement 5: Backend-API

**User Story:** Als Entwickler möchte ich klare API-Endpunkte haben, damit Frontend und Backend sauber kommunizieren.

#### Acceptance Criteria

1. THE Stoppuhr-Backend SHALL einen GET-Endpunkt bereitstellen, der den aktuellen Stoppuhr-Zustand zurückgibt.
2. THE Stoppuhr-Backend SHALL einen POST-Endpunkt bereitstellen, der Start- und Stop-Aktionen entgegennimmt.
3. WHEN ein Client eine Start- oder Stop-Aktion sendet, THE Stoppuhr-Backend SHALL prüfen, ob der sendende Client der aktuelle Controller ist.
4. IF ein Client eine Steuerungsaktion sendet und nicht der aktuelle Controller ist, THEN THE Stoppuhr-Backend SHALL die Aktion ablehnen und einen Fehlercode zurückgeben.

### Requirement 6: Deployment

**User Story:** Als Entwickler möchte ich die Anwendung auf Vercel deployen, damit sie öffentlich erreichbar ist.

#### Acceptance Criteria

1. THE Stoppuhr-Backend SHALL als Vercel Serverless Functions (Node.js) implementiert sein.
2. THE Stoppuhr-Frontend SHALL als statische Dateien über Vercel ausgeliefert werden.
3. THE Stoppuhr-Backend SHALL über Vercel KV (Upstash Redis) auf den persistenten Zustand zugreifen.

### Requirement 7: Fehlerbehandlung

**User Story:** Als Benutzer möchte ich, dass die Anwendung bei Verbindungsproblemen stabil bleibt, damit ich keine schlechte Erfahrung habe.

#### Acceptance Criteria

1. IF das Stoppuhr-Frontend keine Verbindung zum Stoppuhr-Backend herstellen kann, THEN THE Stoppuhr-Frontend SHALL die zuletzt bekannte Zeit weiterhin anzeigen und einen Verbindungsfehler-Hinweis darstellen.
2. IF das Stoppuhr-Backend keine Verbindung zu Vercel KV herstellen kann, THEN THE Stoppuhr-Backend SHALL einen HTTP-500-Fehler mit einer aussagekräftigen Fehlermeldung zurückgeben.
