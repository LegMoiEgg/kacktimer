# Requirements Document

## Introduction

Dieses Dokument beschreibt die Anforderungen für das Feature "Food Category Management" im Kacktimer. Es umfasst zwei Hauptänderungen: (1) Dynamische Verwaltung von Essenskategorien anstelle der aktuell fest im HTML codierten Optionen, und (2) die Umstellung der Essenszuweisung von tagesbasiert auf sitzungsbasiert, sodass jede individuelle Session ein eigenes Essen zugeordnet bekommen kann.

## Glossary

- **Kacktimer**: Die bestehende Web-Applikation (Shared Timer) zum Tracken von Sessions
- **Session**: Ein einzelner Timer-Durchlauf mit Start- und Endzeitpunkt und Dauer
- **Food_Category**: Eine benannte Essenskategorie (z.B. "DB-Casino", "Penny")
- **Category_Manager**: Die UI-Komponente zur Verwaltung (Erstellen, Bearbeiten, Löschen) von Food Categories
- **Backend**: Vercel Serverless Functions (api/state.js, api/control.js)
- **KV_Store**: Vercel KV (Redis-basierter Key-Value-Store) als persistenter Speicher
- **Food_Assignment**: Die Zuordnung einer Food Category zu einer spezifischen Session
- **Frontend**: Die Single-Page HTML-Anwendung mit Vanilla JavaScript

## Requirements

### Requirement 1: Persistente Speicherung von Essenskategorien

**User Story:** Als Benutzer möchte ich, dass Essenskategorien im Backend gespeichert werden, damit sie dynamisch verwaltet werden können und nicht fest im HTML codiert sind.

#### Acceptance Criteria

1. THE Backend SHALL persist Food Categories as an ordered list of strings (maximum 20 entries, each up to 50 characters) in the KV_Store under a dedicated key
2. WHEN the Frontend requests the application state, THE Backend SHALL return the current ordered list of Food Categories as a property within the state response object
3. WHEN no Food Categories exist in the KV_Store, THE Backend SHALL initialize the list with the default categories in this order: "DB-Casino", "Onda Chicken", "Selbstgemacht", "Penny"
4. IF the KV_Store is unavailable when Food Categories are requested, THEN THE Backend SHALL return the default categories ("DB-Casino", "Onda Chicken", "Selbstgemacht", "Penny") as a fallback within the state response

### Requirement 2: Erstellen neuer Essenskategorien

**User Story:** Als Benutzer möchte ich neue Essenskategorien erstellen können, damit ich weitere Restaurants oder Essensquellen hinzufügen kann.

#### Acceptance Criteria

1. WHEN a user submits a new category name, THE Backend SHALL add the new Food Category to the persisted list in the KV_Store and return the created category name in the response
2. WHEN a user submits a new category name, THE Frontend SHALL display the new category immediately in the food selection dropdown without requiring a page reload
3. IF the submitted category name is empty or consists only of whitespace, THEN THE Backend SHALL reject the request and return a validation error indicating that the category name must not be blank
4. IF a category with the same name (case-insensitive comparison) already exists, THEN THE Backend SHALL reject the request and return a duplicate error indicating that the category already exists
5. IF the submitted category name exceeds 50 characters, THEN THE Backend SHALL reject the request and return a validation error indicating the maximum length has been exceeded
6. IF the KV_Store is unavailable when adding a new category, THEN THE Backend SHALL return an error indicating that the category could not be saved, and THE Frontend SHALL display an error message to the user

### Requirement 3: Bearbeiten bestehender Essenskategorien

**User Story:** Als Benutzer möchte ich bestehende Essenskategorien umbenennen können, damit ich Tippfehler korrigieren oder Namen aktualisieren kann.

#### Acceptance Criteria

1. WHEN a user submits a rename request with a valid old category name and a new category name of 1 to 50 characters (after trimming), THE Backend SHALL update the category name in the persisted list in the KV_Store and return a success response within 3 seconds
2. WHEN a Food Category is successfully renamed, THE Backend SHALL update all existing session food fields in the KV_Store that reference the old category name to use the new name in the same atomic operation
3. IF the new category name is empty, consists only of whitespace, or exceeds 50 characters after trimming, THEN THE Backend SHALL reject the rename request and return a validation error indicating the name constraint violated
4. IF a category with the new name (after trimming) already exists in the persisted list (case-insensitive comparison), THEN THE Backend SHALL reject the rename request and return a duplicate error indicating the conflicting name
5. IF the old category name specified in the rename request does not exist in the persisted list, THEN THE Backend SHALL reject the rename request and return an error indicating the category was not found

### Requirement 4: Löschen bestehender Essenskategorien

**User Story:** Als Benutzer möchte ich Essenskategorien löschen können, die nicht mehr relevant sind.

#### Acceptance Criteria

1. WHEN a user deletes a Food Category, THE Backend SHALL remove the category from the persisted list in the KV_Store and return a success response
2. WHEN a Food Category is deleted, THE Backend SHALL retain existing Food Assignments that reference the deleted category unchanged
3. WHEN the Frontend displays a food selection dropdown, THE Frontend SHALL show only Food Categories that are present in the persisted list from the KV_Store
4. IF the category name submitted for deletion does not exist in the persisted list, THEN THE Backend SHALL reject the request and return a not-found error
5. WHEN a Food Category is successfully deleted, THE Frontend SHALL immediately remove the category from the food selection dropdown and the Category_Manager list

### Requirement 5: UI zur Verwaltung von Essenskategorien

**User Story:** Als Benutzer möchte ich eine übersichtliche Oberfläche zur Verwaltung der Essenskategorien haben, damit ich Kategorien einfach erstellen, bearbeiten und löschen kann.

#### Acceptance Criteria

1. THE Frontend SHALL display a toggle button labeled "Kategorien verwalten" within the food-selector-container that shows and hides the Category_Manager panel
2. THE Category_Manager SHALL list all existing Food Categories, each displaying the category name with an adjacent edit button and a delete button
3. THE Category_Manager SHALL provide a text input field (maximum 50 characters) and a "Hinzufügen" button to create a new Food Category
4. IF the user submits an empty category name or a name that already exists (case-insensitive) during creation or editing, THEN THE Frontend SHALL display an inline error message indicating the specific validation failure and preserve the user's input in the field
5. WHEN the user confirms deletion of a Food Category, THE Category_Manager SHALL remove that category from the list and update the food selector dropdown within 1 second
6. WHEN the user clicks the edit button on a category, THE Category_Manager SHALL replace the category name text with a pre-filled text input field and a save button, allowing inline editing of the name

### Requirement 6: Sitzungsbasierte Essenszuweisung

**User Story:** Als Benutzer möchte ich jeder einzelnen Session ein Essen zuordnen können, anstatt nur ein Essen pro Tag, damit die Statistiken genauer sind wenn sich das Essen im Laufe des Tages ändert.

#### Acceptance Criteria

1. WHEN a session is stopped, THE Backend SHALL store the food category currently selected in the food selector as the `food` field of that session object. IF no food category has been selected at the time the session is stopped, THEN THE Backend SHALL store the value "Unbekannt" as the `food` field.
2. THE Backend SHALL store the Food_Assignment as a field within the session object (e.g. `session.food`)
3. WHEN displaying the history, THE Frontend SHALL show the Food_Assignment for each individual session as a label within the session's history entry, using the same category name stored in the session's `food` field.
4. WHEN the user selects a different food category for a past session in the history view, THE Frontend SHALL send an update request to the Backend, and THE Backend SHALL persist the new food category value in that session's `food` field. The available food categories for selection SHALL be the same set of options available in the main food selector.
5. IF the Backend fails to persist a food category change for a past session, THEN THE Frontend SHALL retain the previous food category value for that session and display an error indication to the user within 3 seconds of the failed request.
6. WHEN loading sessions that were created before this feature and have no `food` field, THE Frontend SHALL display "Unbekannt" as the food category for those sessions.

### Requirement 7: Datenmigration von tagesbasierter zu sitzungsbasierter Essenszuweisung

**User Story:** Als Benutzer möchte ich, dass bestehende tagesbasierte Essensdaten automatisch migriert werden, damit keine historischen Informationen verloren gehen.

#### Acceptance Criteria

1. WHEN the Backend reads state and encounters sessions without a food field but with a matching entry in dailyFood for that session's date, THE Backend SHALL derive the date from the session's start timestamp using German locale format (toLocaleDateString('de-DE'), e.g. "6.8.2025") and assign the corresponding dailyFood value to the session's food field
2. IF a session's derived date has no matching key in dailyFood, THEN THE Backend SHALL leave that session's food field unchanged (undefined)
3. WHEN all sessions in the state have been checked and migrated, THE Backend SHALL remove the dailyFood object from the persisted state
4. THE Backend SHALL perform the migration automatically on the first state read after deployment, completing within the same request-response cycle
5. IF the migration encounters a KV write failure, THEN THE Backend SHALL return the unmigrated state to the client and retry migration on the next state read

### Requirement 8: Statistiken mit sitzungsbasiertem Essen

**User Story:** Als Benutzer möchte ich, dass die Essens-Statistiken auf den sitzungsbasierten Essensdaten basieren, damit die Charts korrekte Informationen anzeigen.

#### Acceptance Criteria

1. WHEN rendering the food statistics chart, THE Frontend SHALL group sessions by each session's own food property and display one bar per food category showing summed duration in minutes on the left y-axis and session count on the right y-axis
2. IF a session's food property is undefined, null, empty, or equals "Unbekannt", THEN THE Frontend SHALL categorize that session under the label "Keine Angabe" in the food statistics chart
3. THE Frontend SHALL not reference the dailyFood object when calculating or rendering the food statistics chart
4. WHEN all sessions fall into the "Keine Angabe" category, THE Frontend SHALL render the food chart with a single "Keine Angabe" bar displaying the total duration and count
