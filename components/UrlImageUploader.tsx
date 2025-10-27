
import React, { useState, useCallback } from 'react';
import { ImageIcon, SpinnerIcon } from './icons';

interface UrlImageUploaderProps {
  onFilesCreated: (files: File[], urls: string[]) => void;
  isProcessing: boolean;
}

const UrlImageUploader: React.FC<UrlImageUploaderProps> = ({ onFilesCreated, isProcessing }) => {
  const [urls, setUrls] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const getDirectDownloadUrl = (originalUrl: string): string | null => {
    if (originalUrl && typeof originalUrl === 'string' && originalUrl.includes('drive.google.com')) {
      try {
        const regex = /\/d\/([a-zA-Z0-9_-]{25,})/;
        const match = originalUrl.match(regex);
        
        if (match && match[1]) {
          const fileId = match[1];
          return `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      } catch (e) {
        console.error("Error parsing Google Drive URL:", e);
        return null;
      }
    }
    return null;
  };

  const handleLoadImages = useCallback(async () => {
    const urlsToFetch = urls.split('\n').filter(url => url.trim() !== '');

    if (urlsToFetch.length === 0) {
      setError('Por favor, introduce al menos una URL.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const fetchWithTimeout = (resource: string, options: RequestInit = {}, timeout = 20000): Promise<Response> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      const responsePromise = fetch(resource, {
        ...options,
        signal: controller.signal  
      });

      return responsePromise.finally(() => {
        clearTimeout(id);
      });
    };

    // Using a more reliable image proxy: images.weserv.nl
    // It requires the URL without the protocol, so we strip it.
    const CORS_PROXY_PREFIX = "https://images.weserv.nl/?url=";

    try {
      const filePromises = urlsToFetch.map(async (url, index) => {
        const downloadUrl = getDirectDownloadUrl(url);
        if (!downloadUrl) {
          throw new Error(`URL inválida o no es de Google Drive: ${url}`);
        }

        // The proxy requires the URL without http(s)://
        const urlForProxy = downloadUrl.replace(/^https?:\/\//, '');
        const proxyUrl = `${CORS_PROXY_PREFIX}${encodeURIComponent(urlForProxy)}`;

        const response = await fetchWithTimeout(proxyUrl, {}, 20000);

        if (!response.ok) {
          throw new Error(`Error al descargar la imagen de ${url}. Status: ${response.status}`);
        }
        
        const contentDisposition = response.headers.get('content-disposition');
        let originalFileName: string | null = null;
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (fileNameMatch && fileNameMatch[1]) {
            try {
              originalFileName = decodeURIComponent(fileNameMatch[1]);
            } catch (e) {
              originalFileName = fileNameMatch[1];
            }
          }
        }

        const blob = await response.blob();
        if (blob.type === 'text/html') { // The proxy might return an error page
          throw new Error(`El proxy devolvió un error para la URL: ${url}. Verifica el enlace.`);
        }

        const fallbackName = url.replace(/[\\/:*?"<>|]/g, '_');
        const fileName = originalFileName || fallbackName;
        return new File([blob], fileName, { type: blob.type });
      });

      const files = await Promise.all(filePromises);
      onFilesCreated(files, urlsToFetch);
      setUrls('');

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('La descarga tardó demasiado y fue cancelada. Inténtalo de nuevo.');
      } else {
        setError(err.message || 'Ocurrió un error al cargar las imágenes.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [urls, onFilesCreated]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-12">
      <div className="bg-gray-800 p-8 rounded-lg border-2 border-dashed border-gray-600">
        <div className="text-center mb-6">
          <ImageIcon className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-100">Cargar desde Google Drive</h3>
          <p className="text-sm text-gray-400">Pega los enlaces de las imágenes de la luminaria.</p>
        </div>
        
        <div className="space-y-4">
          <textarea
            name="urls"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="Pega aquí las URLs de las imágenes, una por línea..."
            className="w-full h-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}

        <div className="mt-6">
          <button
            onClick={handleLoadImages}
            disabled={isLoading || isProcessing}
            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <SpinnerIcon className="w-5 h-5 animate-spin mr-3" />
                Cargando Imágenes...
              </>
            ) : (
              'Cargar Imágenes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UrlImageUploader;
