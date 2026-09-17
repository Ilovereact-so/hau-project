Wrzuć tu kilka zdjęć (.jpg / .jpeg / .png / .webp) — nazwy plików bez znaczenia.

Skrypt src/scripts/assignRandomSubcategoryImages.ts losuje z tego folderu
jedno zdjęcie dla każdej subkategorii w Sanity i je tam wgrywa (nadpisując
istniejące, jeśli subkategoria już jakieś miała).

Uruchomienie (z katalogu głównego projektu, w PowerShell):
    npx tsx src/scripts/assignRandomSubcategoryImages.ts

Ten plik możesz usunąć — jest tylko po to, żeby folder istniał w repo
zanim wrzucisz do niego prawdziwe zdjęcia.
