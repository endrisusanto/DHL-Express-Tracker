import React, { useState, useEffect } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import { analyzeShipment } from '../services/gemini';
import { DHLShipment } from '../types';

interface Props {
  shipment: DHLShipment;
}

export const AIAnalysis: React.FC<Props> = ({ shipment }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    const result = await analyzeShipment(shipment);
    setAnalysis(result);
    setLoading(false);
  };

  // Reset analysis when shipment changes
  useEffect(() => {
      setAnalysis(null);
  }, [shipment.id]);

  if (!process.env.API_KEY) {
      return null; // Don't show if no API key
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100 mb-6">
      <div className="flex items-start gap-4">
        <div className="bg-indigo-600 text-white p-2.5 rounded-lg shadow-md shadow-indigo-200">
          <Sparkles size={20} />
        </div>
        <div className="flex-1">
          <h3 className="text-indigo-900 font-bold text-lg mb-1">AI Status Insight</h3>
          <p className="text-indigo-700/80 text-sm mb-4">
            Get a smart summary of your shipment status powered by Gemini AI.
          </p>

          {!analysis && !loading && (
            <button 
              onClick={handleAnalyze}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm inline-flex items-center gap-2"
            >
               <Sparkles size={16} /> Analyze Tracking
            </button>
          )}

          {loading && (
             <div className="flex items-center gap-2 text-indigo-700 text-sm animate-pulse">
                 <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                 Analyzing shipment events...
             </div>
          )}

          {analysis && (
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 text-indigo-900 text-sm leading-relaxed border border-indigo-100 shadow-sm">
               {analysis}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
