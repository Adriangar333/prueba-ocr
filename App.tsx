
import React, { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { ProcessedImage, StoredImage, ProcessingStatus, ExtractionResult, LuminariaData } from './types';
import { extractCodeFromImage } from './services/geminiService';
import { getAllImages, setImage, clearAllImages } from './services/db';
import { analyzeLuminariaGroup, extractWattsFromLabel, extractTipoFromLabel } from './services/analysisService';
import ImageUploader from './components/ImageUploader';
import UrlImageUploader from './components/UrlImageUploader';
import ImageGrid from './components/ImageGrid';
import LuminariaDataTable from './components/LuminariaDataTable';
import { ImageIcon, SpinnerIcon, TrashIcon, PackageIcon, KeyIcon, XIcon, FileSpreadsheetIcon, UploadIcon, LinkIcon } from './components/icons';
import * as XLSX from 'xlsx';

// Polyfill for process.env in browser environments.
if (typeof window !== 'undefined' && !(window as any).process) {
  (window as any).process = { env: {} };
}

const generateUUID = () => {
  if (typeof self !== 'undefined' && self.crypto && self.crypto.randomUUID) {
    return self.crypto.randomUUID();
  } else {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 720;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const quality = 0.7;
        let outputFormat = 'image/jpeg';
        if (file.type.startsWith('image/png')) {
          outputFormat = 'image/png';
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: outputFormat,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          outputFormat,
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

const BATCH_SIZE = 50;

const ApiKeyModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  setApiKey: (key: string) => void;
}> = ({ isOpen, onClose, apiKey, setApiKey }) => {
  const [localApiKey, setLocalApiKey] = useState(apiKey);

  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setApiKey(localApiKey);
    localStorage.setItem('apiKey', localApiKey);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Configurar Clave de API</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <p className="text-gray-400 mb-4">
          Introduce tu clave de API de Google Gemini. Se guardará en tu navegador para futuras sesiones.
        </p>
        <input
          type="password"
          value={localApiKey}
          onChange={(e) => setLocalApiKey(e.target.value)}
          placeholder="Pega tu clave de API aquí"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
        />
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
          >
            Guardar Clave
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [operatingMode, setOperatingMode] = useState<'lote' | 'individual'>('lote');
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [luminariaData, setLuminariaData] = useState<LuminariaData[]>([]);
  const [activeLote, setActiveLote] = useState<LuminariaData | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');

  useEffect(() => {
    const loadState = async () => {
        try {
            const storedImages = await getAllImages();
            const processedImages = storedImages.map(img => ({
                ...img,
                previewUrl: URL.createObjectURL(img.file)
            }));
            setImages(processedImages);
            
            const storedApiKey = localStorage.getItem('apiKey');
            if (storedApiKey) setApiKey(storedApiKey);

        } catch (error) {
            console.error("Failed to load state from storage", error);
        }
    };
    loadState();
  }, []);

  useEffect(() => {
    return () => {
        const allUrls = [
            ...images.map(img => img.previewUrl),
            ...luminariaData.flatMap(ld => ld.processedImages.map(pi => pi.previewUrl))
        ];
        const uniqueUrls = [...new Set(allUrls)];
        uniqueUrls.forEach(url => URL.revokeObjectURL(url));
    }
  }, []);

  const handleSetApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('apiKey', key);
  };

  const handleFilesSelected = useCallback(async (files: File[], urls: string[] = []) => {
    const processedFilesPromises = files.map(async (file, index) => {
      const compressedFile = await compressImage(file);
      return {      
        id: generateUUID(),
        file: compressedFile,
        status: 'pending' as ProcessingStatus,
        extractedResult: null,
        sourceUrl: urls[index] || undefined
      };
    });
    
    const newStoredImages: StoredImage[] = await Promise.all(processedFilesPromises);

    for (const img of newStoredImages) {
        await setImage(img);
    }

    const newProcessedImages = newStoredImages.map(img => ({
        ...img,
        previewUrl: URL.createObjectURL(img.file)
    }));

    setImages(prev => [...prev, ...newProcessedImages]);
  }, []);

  // --- LOGIC FOR LOTE MODE ---
  const handleLuminariaDataChange = useCallback((updatedData: LuminariaData) => {
    setActiveLote(updatedData);
    setLuminariaData(currentData => 
      currentData.map(d => d.id === updatedData.id ? updatedData : d)
    );
  }, []);

  const processLuminariaBatch = useCallback(async () => {
    const pendingImages = images.filter(img => img.status === 'pending');
    if (isProcessing || pendingImages.length < 3) return;

    const batchToProcess = pendingImages.slice(0, 3);
    setIsProcessing(true);
    setProcessingMessage(`Iniciando lote de 3 imágenes...`);

    const processedBatch: ProcessedImage[] = [];
    for (let i = 0; i < batchToProcess.length; i++) {
        const image = batchToProcess[i];
        setProcessingMessage(`Procesando imagen ${i + 1} de 3...`);
        try {
            const result = await extractCodeFromImage(image.file);
            processedBatch.push({ ...image, status: 'success', extractedResult: result });
        } catch (error) {
            const errorMessage = error instanceof Error ? { extractedCode: error.message, predictions: [] } : { extractedCode: 'Error desconocido', predictions: [] };
            processedBatch.push({ ...image, status: 'error', extractedResult: errorMessage });
        }
    }

    setProcessingMessage('Analizando grupo de imágenes...');
    const newRowData = analyzeLuminariaGroup(processedBatch);
    setLuminariaData(prev => [newRowData, ...prev]);
    setActiveLote(newRowData);
    setImages(current => current.filter(img => !batchToProcess.some(b => b.id === img.id)));
    setIsProcessing(false);
    setProcessingMessage(`Lote de 3 imágenes completado.`);
  }, [images, isProcessing, apiKey]);

  // --- LOGIC FOR INDIVIDUAL MODE ---
  const processIndividualImages = useCallback(async () => {
    const pendingImages = images.filter(img => img.status === 'pending');
    if (isProcessing || pendingImages.length === 0) return;

    const batchToProcess = pendingImages.slice(0, BATCH_SIZE);
    setIsProcessing(true);
    setProcessingMessage(`Iniciando lote de ${batchToProcess.length} imágenes...`);

    const results: { id: string; status: ProcessingStatus; extractedResult: ExtractionResult | null }[] = [];
    for (let i = 0; i < batchToProcess.length; i++) {
        const image = batchToProcess[i];
        setProcessingMessage(`Procesando ${i + 1} de ${batchToProcess.length}...`);
        try {
            const result = await extractCodeFromImage(image.file);
            results.push({ id: image.id, status: 'success', extractedResult: result });
        } catch (error) {
            const errorMessage = error instanceof Error ? { extractedCode: error.message, predictions: [] } : { extractedCode: 'Error desconocido', predictions: [] };
            results.push({ id: image.id, status: 'error', extractedResult: errorMessage });
        }
    }

    const updatedImages = images.map(img => {
      const result = results.find(r => r.id === img.id);
      return result ? { ...img, status: result.status, extractedResult: result.extractedResult } : img;
    });

    for (const image of updatedImages) {
      if (results.some(r => r.id === image.id)) {
        await setImage(image);
      }
    }

    setImages(updatedImages);
    setIsProcessing(false);
    setProcessingMessage(`Lote de ${batchToProcess.length} imágenes completado.`);
  }, [images, isProcessing, apiKey]);

  const handleCodeEdited = useCallback(async (imageId: string, newCode: string) => {
    const allImageSources = [images, luminariaData.flatMap(l => l.processedImages)];
    let imageToUpdate: ProcessedImage | undefined;
    let sourceStateUpdater: React.Dispatch<React.SetStateAction<any>> | undefined;

    for (const source of allImageSources) {
        const found = source.find(img => img.id === imageId);
        if (found) {
            imageToUpdate = found;
            break;
        }
    }

    if (!imageToUpdate) return;

    const updatedImage = { ...imageToUpdate, extractedResult: { ...imageToUpdate.extractedResult, extractedCode: newCode } as ExtractionResult };
    await setImage(updatedImage);

    setImages(current => current.map(img => img.id === imageId ? updatedImage : img));
    setLuminariaData(current => current.map(lote => ({
        ...lote,
        processedImages: lote.processedImages.map(img => img.id === imageId ? updatedImage : img)
    })));
    if(activeLote) {
      setActiveLote(current => current ? { ...current, processedImages: current.processedImages.map(img => img.id === imageId ? updatedImage : img) } : null);
    }

  }, [images, luminariaData, activeLote]);

  const handlePredictionClassEdited = useCallback(async (imageId: string, predictionId: string, newClass: string) => {
    const allImageSources = [images, luminariaData.flatMap(l => l.processedImages)];
    let imageToUpdate: ProcessedImage | undefined;

    for (const source of allImageSources) {
        const found = source.find(img => img.id === imageId);
        if (found) {
            imageToUpdate = found;
            break;
        }
    }

    if (!imageToUpdate || !imageToUpdate.extractedResult) return;

    const updatedPredictions = imageToUpdate.extractedResult.predictions.map(p => p.detection_id === predictionId ? { ...p, class: newClass } : p);
    const updatedImage = { ...imageToUpdate, extractedResult: { ...imageToUpdate.extractedResult, predictions: updatedPredictions } };
    await setImage(updatedImage);

    setImages(current => current.map(img => img.id === imageId ? updatedImage : img));
    setLuminariaData(current => current.map(lote => ({
        ...lote,
        processedImages: lote.processedImages.map(img => img.id === imageId ? updatedImage : img)
    })));
    if(activeLote) {
      setActiveLote(current => current ? { ...current, processedImages: current.processedImages.map(img => img.id === imageId ? updatedImage : img) } : null);
    }
  }, [images, luminariaData, activeLote]);

  const handleDownloadAll = useCallback(async () => {
    const imagesToDownload = images.filter(img => img.status === 'success' || img.status === 'error');
    if (imagesToDownload.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("luminarias_procesadas");
    if (!folder) return;

    setProcessingMessage(`Comprimiendo ${imagesToDownload.length} imágenes...`);
    for (const image of imagesToDownload) {
        const extension = image.file.name.split('.').pop() || 'jpg';
        const safeCode = image.extractedResult?.extractedCode?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'sin_codigo';
        const uniquePart = image.id.substring(0, 8);
        const finalName = (image.status !== 'success' || safeCode === 'no_encontrado' || !image.extractedResult?.extractedCode) ? `no-encontrado_${uniquePart}` : safeCode;
        folder.file(`${finalName}.${extension}`, image.file);
    }

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = "luminarias_procesadas.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setProcessingMessage(`Se descargaron ${imagesToDownload.length} imágenes.`);
  }, [images]);

  const handleExportToExcel = useCallback(() => {
    if (luminariaData.length === 0) {
      alert('No hay datos procesados para exportar.');
      return;
    }

    const getBestCode = (images: ProcessedImage[]): string => {
      const codes = images
        .map(img => img.extractedResult?.extractedCode)
        .filter((code): code is string => code != null && code.trim() !== '' && code.trim().toLowerCase() !== 'no encontrado');

      if (codes.length === 0) return 'N/A';

      const codeCounts = codes.reduce((acc, code) => {
        acc[code] = (acc[code] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const [bestCode] = Object.entries(codeCounts).sort(([,a],[,b]) => b - a)[0];
      return bestCode;
    };

    const dataToExport = luminariaData.map(item => ({
      'Codigo Seleccionado': getBestCode(item.processedImages),
      Coincidencia: item.coincidencia,
      'Tipo de Iluminaria': item.tipoIluminaria || 'N/A',
      Watts: item.watts || 'N/A',
      Aprobado: item.aprobado ? 'Sí' : 'No',
      'URL Panoramica': item.processedImages[0]?.sourceUrl || 'N/A',
      'URL Codigo': item.processedImages[1]?.sourceUrl || 'N/A',
      'URL Ficha': item.processedImages[2]?.sourceUrl || 'N/A',
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Luminarias');
    XLSX.writeFile(wb, 'luminarias_exportadas.xlsx');
  }, [luminariaData]);

  const handleExportIndividualToExcel = useCallback(() => {
    const imagesToExport = images.filter(img => img.status === 'success' || img.status === 'error');
    if (imagesToExport.length === 0) {
      alert('No hay imágenes procesadas para exportar.');
      return;
    }

    const dataToExport = imagesToExport.map(image => {
      const baseData: { [key: string]: any } = {
        'Nombre de Archivo': image.file.name,
        'Codigo Extraido': image.extractedResult?.extractedCode || 'N/A',
        'Status': image.status,
      };

      const allPredictions = image.extractedResult?.predictions || [];
      const filteredPredictions = allPredictions.filter(p => !/^\d$/.test(p.class));
      const sortedPredictions = filteredPredictions.sort((a, b) => b.confidence - a.confidence);
      
      const bestPrediction = sortedPredictions[0];
      baseData['Tipo de Iluminaria (sugerido)'] = bestPrediction ? extractTipoFromLabel(bestPrediction.class) : 'N/A';
      baseData['Watts (sugerido)'] = bestPrediction ? extractWattsFromLabel(bestPrediction.class) : 'N/A';

      sortedPredictions.forEach((prediction, index) => {
        baseData[`Prediccion ${index + 1}`] = prediction.class;
        baseData[`Confianza ${index + 1}`] = `${(prediction.confidence * 100).toFixed(1)}%`;
      });

      return baseData;
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Imagenes Individuales');
    XLSX.writeFile(wb, 'imagenes_individuales_export.xlsx');
  }, [images]);

  const clearAll = async () => {
    await clearAllImages();
    const allUrls = [...images.map(img => img.previewUrl), ...luminariaData.flatMap(ld => ld.processedImages.map(pi => pi.previewUrl))];
    const uniqueUrls = [...new Set(allUrls)];
    uniqueUrls.forEach(url => URL.revokeObjectURL(url));
    setImages([]);
    setLuminariaData([]);
    setActiveLote(null);
    setProcessingMessage('');
  };

  const Uploader = () => (
    <div className="w-full">
      <div className="flex justify-center mb-4 border-b border-gray-700">
        <button onClick={() => setUploadMethod('file')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${uploadMethod === 'file' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}><UploadIcon className="w-5 h-5" />Cargar Archivos</button>
        <button onClick={() => setUploadMethod('url')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${uploadMethod === 'url' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}><LinkIcon className="w-5 h-5" />Cargar desde URL</button>
      </div>
      {uploadMethod === 'file' ? <ImageUploader onFilesSelected={(files) => handleFilesSelected(Array.from(files))} isProcessing={isProcessing} /> : <UrlImageUploader onFilesCreated={handleFilesSelected} isProcessing={isProcessing} />}
    </div>
  );

  const renderIndividualMode = () => {
    const pendingCount = images.filter(img => img.status === 'pending').length;
    const processedCount = images.filter(img => img.status === 'success' || img.status === 'error').length;
    return (
      <>
        <div className="bg-gray-800 py-4 px-4 sm:px-6 lg:px-8 shadow-inner">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex-grow">{isProcessing ? <div className="flex items-center text-blue-300"><SpinnerIcon className="w-5 h-5 animate-spin mr-3" /><span>{processingMessage}</span></div> : <p className="text-gray-300">{images.length} imágenes cargadas. {pendingCount} pendientes.</p>}</div>
            <div className="flex items-center gap-4 flex-wrap">
              <button onClick={processIndividualImages} disabled={isProcessing || pendingCount === 0} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">{isProcessing ? 'Procesando...' : `Procesar Individuales (${pendingCount})`}</button>
              <button onClick={handleExportIndividualToExcel} disabled={isProcessing || processedCount === 0} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"><FileSpreadsheetIcon className="w-5 h-5 mr-2" />Exportar a Excel ({processedCount})</button>
              <button onClick={handleDownloadAll} disabled={isProcessing || processedCount === 0} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"><PackageIcon className="w-5 h-5 mr-2" />Descargar ZIP ({processedCount})</button>
              <button onClick={clearAll} disabled={isProcessing} className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-200 bg-gray-700 hover:bg-red-700 hover:border-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><TrashIcon className="w-5 h-5 mr-2" />Limpiar Todo</button>
            </div>
          </div>
        </div>
        {images.length > 0 ? <ImageGrid images={images} onCodeEdited={handleCodeEdited} onPredictionClassEdited={handlePredictionClassEdited} /> : <Uploader />}
      </>
    );
  };

  const renderLoteMode = () => {
    const pendingCount = images.filter(img => img.status === 'pending').length;
    const processedCount = luminariaData.length;
    return (
      <>
        <div className="bg-gray-800 py-4 px-4 sm:px-6 lg:px-8 shadow-inner">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex-grow">{isProcessing ? <div className="flex items-center text-blue-300"><SpinnerIcon className="w-5 h-5 animate-spin mr-3" /><span>{processingMessage}</span></div> : <p className="text-gray-300">{pendingCount} imágenes pendientes. {processedCount} lotes procesados.</p>}</div>
            <div className="flex items-center gap-4 flex-wrap">
              <button onClick={processLuminariaBatch} disabled={isProcessing || pendingCount < 3} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">{isProcessing ? 'Procesando...' : `Procesar Lote de 3`}</button>
              <button onClick={handleExportToExcel} disabled={isProcessing || processedCount === 0} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"><FileSpreadsheetIcon className="w-5 h-5 mr-2" />Exportar a Excel ({processedCount})</button>
              <button onClick={clearAll} disabled={isProcessing} className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-200 bg-gray-700 hover:bg-red-700 hover:border-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><TrashIcon className="w-5 h-5 mr-2" />Limpiar Todo</button>
            </div>
          </div>
        </div>
        
        <Uploader />

        {activeLote && (
          <div className="my-4">
            <h2 className="text-2xl font-bold text-white mb-4 px-4 sm:px-6 lg:px-8">Detalle del Lote Procesado</h2>
            <ImageGrid images={activeLote.processedImages} onCodeEdited={handleCodeEdited} onPredictionClassEdited={handlePredictionClassEdited} />
            <LuminariaDataTable data={[activeLote]} onDataChange={handleLuminariaDataChange} />
          </div>
        )}

        <ImageGrid title="Imágenes Pendientes por Procesar" images={images.filter(img => img.status === 'pending')} onCodeEdited={handleCodeEdited} onPredictionClassEdited={handlePredictionClassEdited} />

      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} apiKey={apiKey} setApiKey={handleSetApiKey} />
      <header className="bg-gray-800/50 backdrop-blur-lg shadow-md sticky top-0 z-10 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <ImageIcon className="h-8 w-8 text-blue-400" />
              <h1 className="text-xl font-bold ml-3 text-gray-100">Extractor de Códigos de Luminarias</h1>
            </div>
            <button onClick={() => setIsApiKeyModalOpen(true)} className="p-2 rounded-full hover:bg-gray-700 transition-colors" title="Configurar Clave de API"><KeyIcon className={`h-6 w-6 ${apiKey ? 'text-green-400' : 'text-yellow-400'}`} /></button>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4">
        <div className="my-6 flex justify-center items-center bg-gray-800 p-2 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold text-white mr-4">Modo de Operación:</h2>
            <div className="flex rounded-md bg-gray-700">
                <button onClick={() => setOperatingMode('lote')} className={`px-4 py-2 text-sm font-medium rounded-l-md transition-colors ${operatingMode === 'lote' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>Lotes de Luminarias</button>
                <button onClick={() => setOperatingMode('individual')} className={`px-4 py-2 text-sm font-medium rounded-r-md transition-colors ${operatingMode === 'individual' ? 'bg-teal-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>Imágenes Individuales</button>
            </div>
        </div>

        {operatingMode === 'individual' ? renderIndividualMode() : renderLoteMode()}

      </main>
      <footer className="bg-gray-900 text-center py-4 border-t border-gray-800">
        <p className="text-sm text-gray-500">Desarrollado con React y Google Gemini.</p>
      </footer>
    </div>
  );
};

export default App;
