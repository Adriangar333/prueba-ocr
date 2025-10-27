export interface Prediction {
  width: number;
  height: number;
  x: number;
  y: number;
  confidence: number;
  class_id: number;
  class: string;
  detection_id: string;
  parent_id: string;
}

export interface ExtractionResult {
  extractedCode: string;
  predictions: Prediction[];
}

export type ProcessingStatus = 'pending' | 'processing' | 'success' | 'error';

export interface StoredImage {
  id: string;
  file: File;
  status: ProcessingStatus;
  extractedResult: ExtractionResult | null;
  sourceUrl?: string; // To track the original URL for export
}

export interface ProcessedImage extends StoredImage {
  previewUrl: string;
}

export interface LuminariaData {
  id: string;
  processedImages: ProcessedImage[]; // This will hold the 1 or 3 images of the batch
  coincidencia: 'si' | 'no' | 'pendiente' | 'n/a';
  tipoIluminaria: string | null;
  watts: number | null;
  aprobado: boolean;
}
