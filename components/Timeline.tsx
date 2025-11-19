import React from 'react';
import { DHLEvent } from '../types';
import { CheckCircle2, Circle, MapPin } from 'lucide-react';

interface Props {
  events: DHLEvent[];
}

export const Timeline: React.FC<Props> = ({ events }) => {
  if (!events || events.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
        Shipment Journey
      </h3>
      
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-200"></div>

        <div className="space-y-8">
          {events.map((event, index) => {
            const isLatest = index === 0;
            
            return (
              <div key={`${event.date}-${event.time}-${index}`} className="relative flex gap-6">
                {/* Icon/Dot */}
                <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-4 ${isLatest ? 'bg-dhl-red border-red-100' : 'bg-white border-gray-100'}`}>
                   {isLatest ? (
                       <Circle size={14} fill="white" className="text-white" />
                   ) : (
                       <Circle size={12} className="text-gray-300" fill="#e5e7eb" />
                   )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 mb-2">
                    <h4 className={`text-base font-semibold ${isLatest ? 'text-gray-900' : 'text-gray-600'}`}>
                      {event.description}
                    </h4>
                    <span className="text-sm font-medium text-gray-400 whitespace-nowrap">
                      {event.time}, {event.date}
                    </span>
                  </div>
                  
                  {event.serviceArea && event.serviceArea.length > 0 && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <MapPin size={14} className="text-dhl-red" />
                      {event.serviceArea[0].description}
                    </div>
                  )}
                  
                  {event.signedBy && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium border border-green-100">
                        <CheckCircle2 size={12} />
                        Signed by: {event.signedBy}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
