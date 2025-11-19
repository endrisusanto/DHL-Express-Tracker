import React from 'react';
import { DHLShipment } from '../types';
import { Package, MapPin, ArrowRight, Truck, Weight } from 'lucide-react';

interface Props {
  shipment: DHLShipment;
}

export const ShipmentCard: React.FC<Props> = ({ shipment }) => {
  const isDelivered = shipment.status.statusCode === 'delivered' || shipment.status.description.toLowerCase().includes('delivered');

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-6">
      <div className="bg-gradient-to-r from-dhl-yellow to-yellow-400 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-dhl-red font-bold text-xs uppercase tracking-wider mb-1">Tracking Number</p>
            <h2 className="text-3xl font-black text-dhl-red tracking-tight">{shipment.id}</h2>
          </div>
          <div className={`px-4 py-2 rounded-full font-bold shadow-sm ${isDelivered ? 'bg-green-100 text-green-700' : 'bg-white/90 text-dhl-red'}`}>
            {shipment.status.description}
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Origin */}
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-medium uppercase mb-2 flex items-center gap-1">
             <MapPin size={14} /> Origin
          </span>
          <span className="text-xl font-bold text-gray-800">
            {shipment.origin.address.addressLocality}
          </span>
          <span className="text-gray-500 text-sm font-mono">{shipment.origin.address.countryCode}</span>
        </div>

        {/* Arrow Visual */}
        <div className="hidden md:flex items-center justify-center text-dhl-yellow">
          <ArrowRight size={32} strokeWidth={3} />
        </div>

        {/* Destination */}
        <div className="flex flex-col md:items-end">
           <span className="text-gray-400 text-xs font-medium uppercase mb-2 flex items-center gap-1">
             Destination <MapPin size={14} />
          </span>
          <span className="text-xl font-bold text-gray-800 text-right">
            {shipment.destination.address.addressLocality}
          </span>
          <span className="text-gray-500 text-sm font-mono text-right">{shipment.destination.address.countryCode}</span>
        </div>
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-gray-200">
            <Package size={16} className="text-dhl-red" />
            <span>{shipment.details?.product?.productName || shipment.service}</span>
        </div>
        {shipment.details?.weight && (
             <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-gray-200">
             <Weight size={16} className="text-dhl-red" />
             <span>{shipment.details.weight.value} {shipment.details.weight.unitText}</span>
         </div>
        )}
         <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-gray-200 ml-auto">
            <Truck size={16} className="text-dhl-red" />
            <span>Standard Courier</span>
        </div>
      </div>
    </div>
  );
};
