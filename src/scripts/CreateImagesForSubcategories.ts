import * as fs from 'fs/promises';
import * as path from 'path';
import Papa from 'papaparse';
import { createReadStream } from 'fs';

// --- Konf ---
const CSV_FILE = 'src/data/subcat1.csv';            
const BASE_IMAGE_1 = 'src/data/base_1.png';        
const BASE_IMAGE_2 = 'src/data/base_2.png';        
const OUTPUT_DIR = 'data/subcat1';           
const SLUG_COLUMN_NAME = 'slug';       

interface CsvRow {
    [key: string]: string;
}


function parseCsvWithPapa(filePath: string): Promise<CsvRow[]> {
    return new Promise((resolve, reject) => {
        const results: CsvRow[] = [];
        const fileStream = createReadStream(filePath);
        console.log(!fileStream ? 'Brak strumienia pliku' : 'Strumień pliku utworzony');
        
        Papa.parse(fileStream, {
            header: true,           
            skipEmptyLines: true,   
            step: (row) => {       
                const data = row.data as CsvRow; 
                if (data[SLUG_COLUMN_NAME]) {
                    results.push(data);
                }
            },
            complete: () => {
                resolve(results);
            },
            error: (error) => {
                reject(new Error(`Błąd parsowania CSV: ${error.message}`));
            }
        });
    });
}


async function processSlugsAndCopyImages() {
    console.log(`Początek przetwarzania pliku: ${CSV_FILE} za pomocą PapaParse`);

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Utworzono lub potwierdzono istnienie katalogu: ${OUTPUT_DIR}`);

    const results = await parseCsvWithPapa(CSV_FILE);
    console.log(`Znaleziono ${results.length} unikalnych slugów do przetworzenia`);

    let copiedCount = 0;
    for (const row of results) {
        const slug = row[SLUG_COLUMN_NAME];
        
        if (!slug) {
            console.warn(`brak sluga`);
            continue;
        }
        
        const newFileName1 = `${slug}_1${path.extname(BASE_IMAGE_1)}`;
        const newFileName2 = `${slug}_2${path.extname(BASE_IMAGE_2)}`;
        
        const destPath1 = path.join(OUTPUT_DIR, newFileName1);
        const destPath2 = path.join(OUTPUT_DIR, newFileName2);

        try {
            await fs.copyFile(BASE_IMAGE_1, destPath1);            
            await fs.copyFile(BASE_IMAGE_2, destPath2);
            
            copiedCount += 2;
            process.stdout.write(`\rKopiowanie: ${copiedCount} pliku)`);
        } catch (error) {
            console.error(`\nBłąd dla sluga '${slug}'`, error instanceof Error ? error.message : String(error));
        }
    }

    console.log(`\n\nSkopiowano łącznie ${copiedCount} plików do folderu ${OUTPUT_DIR}`);
}

processSlugsAndCopyImages().catch(err => {
    console.error(`\nKrytyczny błąd skryptu: ${err.message}`);
    process.exit(1);
});