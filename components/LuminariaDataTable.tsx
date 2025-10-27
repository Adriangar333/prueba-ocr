
import React from 'react';
import { LuminariaData } from '../types';
import { CheckCircleIcon, XCircleIcon } from './icons';

import ThumbnailCard from './ThumbnailCard';

interface LuminariaDataTableProps {
  data: LuminariaData[];
  onDataChange: (updatedData: LuminariaData) => void;
}

const LuminariaDataTable: React.FC<LuminariaDataTableProps> = ({ data, onDataChange }) => {
  
  const handleFieldChange = (id: string, field: keyof LuminariaData, value: any) => {
    const itemToUpdate = data.find(item => item.id === id);
    if (itemToUpdate) {
      const updatedItem = { ...itemToUpdate, [field]: value };
      onDataChange(updatedItem);
    }
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No hay datos de luminarias procesadas para mostrar.</p>
        <p className="text-sm">Procesa un lote de imágenes para ver los resultados aquí.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="shadow overflow-hidden border-b border-gray-700 sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Imágenes</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Coincidencia</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tipo de Iluminaria</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Watts</th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Aprobar</th>
            </tr>
          </thead>
          <tbody className="bg-gray-900 divide-y divide-gray-700">
            {data.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {item.processedImages.map((pImg, index) => (
                      <ThumbnailCard 
                        key={`${item.id}-thumb-${index}`}
                        src={pImg.previewUrl} 
                        predictions={pImg.extractedResult?.predictions || []} 
                      />
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.coincidencia === 'n/a' ? (
                    <span className="text-gray-400">N/A</span>
                  ) : (
                    <select 
                      value={item.coincidencia}
                      onChange={(e) => handleFieldChange(item.id, 'coincidencia', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </select>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                   <input 
                    type="text"
                    value={item.tipoIluminaria || ''}
                    onChange={(e) => handleFieldChange(item.id, 'tipoIluminaria', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input 
                    type="number"
                    value={item.watts || ''}
                    onChange={(e) => handleFieldChange(item.id, 'watts', parseInt(e.target.value, 10) || null)}
                    className="w-24 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <input 
                    type="checkbox"
                    checked={item.aprobado}
                    onChange={(e) => handleFieldChange(item.id, 'aprobado', e.target.checked)}
                    className="h-6 w-6 bg-gray-700 border-gray-600 rounded text-blue-500 focus:ring-blue-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LuminariaDataTable;
