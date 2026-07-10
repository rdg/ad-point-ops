import i18n from "i18next"
import { initReactI18next } from "react-i18next"

export const LANGUAGE_STORAGE_KEY = "point-ops-language"

export const LOCALES: Record<string, string> = {
  de: "de-DE",
  en: "en-NZ",
}

const resources = {
  de: {
    translation: {
      file: {
        heading: "Datei",
        load: "PLY laden",
        loadDialogTitle: "PLY-Datei(en) öffnen",
        filterName: "Punktwolke",
        batchSelectedCount: "{{count}} Dateien ausgewählt",
        pointsShown: "{{count}} Punkte angezeigt",
        pointsOf: "von {{total}}",
        loading: "Lädt…",
        properties: "Eigenschaften ({{count}})",
      },
      operation: {
        heading: "Operation",
        label: "Operation",
        outputFile: "Ausgabedatei",
        outputPlaceholder: "ausgabe.ply",
        batchNote:
          "Ausgabedateien werden automatisch benannt (z. B. …_{{suffix}}.ply) und beim Ausführen in einen gewählten Ordner geschrieben.",
        run: "Ausführen",
        running: "Läuft…",
        runBatch: "Batch ausführen ({{count}})",
        saveDialogTitle: "Ausgabe speichern unter",
        outputFolderDialogTitle: "Ausgabeordner wählen",
      },
      preview: {
        batchPlaceholder:
          "Keine Vorschau im Batch-Modus — {{count}} Dateien werden verarbeitet.",
        flipTitle: "Vorschau umdrehen",
      },
      toast: {
        loadErrorTitle: "Fehler beim Laden",
        doneTitle: "Fertig",
        errorTitle: "Fehler",
        batchDoneTitle: "Batch fertig",
        batchDoneDescription: "{{count}} Datei(en) verarbeitet",
        batchPartialTitle: "Batch teilweise fehlgeschlagen",
        batchPartialDescription:
          "{{succeeded}} erfolgreich, {{failed}} fehlgeschlagen: {{details}}",
      },
      settings: {
        title: "Einstellungen",
        language: "Sprache",
        languageGerman: "Deutsch",
        languageEnglish: "English (NZ)",
        close: "Schließen",
      },
    },
  },
  en: {
    translation: {
      file: {
        heading: "File",
        load: "Load PLY",
        loadDialogTitle: "Open PLY file(s)",
        filterName: "Point cloud",
        batchSelectedCount: "{{count}} files selected",
        pointsShown: "{{count}} points shown",
        pointsOf: "of {{total}}",
        loading: "Loading…",
        properties: "Properties ({{count}})",
      },
      operation: {
        heading: "Operation",
        label: "Operation",
        outputFile: "Output file",
        outputPlaceholder: "output.ply",
        batchNote:
          "Output filenames are derived automatically (e.g. …_{{suffix}}.ply) and written to a chosen folder when you run it.",
        run: "Run",
        running: "Running…",
        runBatch: "Run batch ({{count}})",
        saveDialogTitle: "Save output as",
        outputFolderDialogTitle: "Choose output folder",
      },
      preview: {
        batchPlaceholder: "No preview in batch mode — {{count}} files will be processed.",
        flipTitle: "Flip preview",
      },
      toast: {
        loadErrorTitle: "Failed to load",
        doneTitle: "Done",
        errorTitle: "Error",
        batchDoneTitle: "Batch done",
        batchDoneDescription: "{{count}} file(s) processed",
        batchPartialTitle: "Batch partially failed",
        batchPartialDescription: "{{succeeded}} succeeded, {{failed}} failed: {{details}}",
      },
      settings: {
        title: "Settings",
        language: "Language",
        languageGerman: "Deutsch",
        languageEnglish: "English (NZ)",
        close: "Close",
      },
    },
  },
}

const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY)

i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage && storedLanguage in resources ? storedLanguage : "de",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
})

export default i18n
