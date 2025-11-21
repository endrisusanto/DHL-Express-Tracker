import React, { useMemo } from 'react';
import { Sparkles, Bot } from 'lucide-react';
import { TrackedShipment } from '../types';

interface Props {
    shipment: TrackedShipment;
}

export const AiSummary: React.FC<Props> = ({ shipment }) => {
    const summary = useMemo(() => {
        if (!shipment) return '';

        const { status, origin, destination, events } = shipment;
        const latestEvent = events[0];
        const isDelivered = status.statusCode === 'delivered';
        const isException = ['failure', 'unknown', 'exception'].includes(status.statusCode);

        let text = '';

        // Intro
        text += `This shipment (AWB: ${shipment.id}) is traveling from **${origin.address.addressLocality}** to **${destination.address.addressLocality}**. `;

        // Status Analysis
        if (isDelivered) {
            text += `It has been **successfully delivered** on ${latestEvent.date} at ${latestEvent.time}. `;
            if (latestEvent.signedBy) {
                text += `The package was signed for by **${latestEvent.signedBy}**. `;
            }
        } else if (isException) {
            text += `⚠️ **Attention Required**: The shipment is currently facing an exception or delay. `;
            text += `The latest status is "${status.description}" at ${status.location.address.addressLocality}. `;
            text += `Please check with the carrier for resolution steps. `;
        } else {
            text += `It is currently **in transit**. `;
            text += `The latest update was at **${latestEvent.time}** on ${latestEvent.date}: "${latestEvent.description}" in ${latestEvent.serviceArea?.[0]?.description || 'unknown location'}. `;

            // Time analysis
            const lastUpdate = new Date(status.timestamp);
            const now = new Date();
            const diffHours = Math.abs(now.getTime() - lastUpdate.getTime()) / 36e5;

            if (diffHours > 48) {
                text += `Note: There have been no updates for over 48 hours. `;
            } else {
                text += `The shipment is moving normally. `;
            }
        }

        return text;
    }, [shipment]);

    // Function to parse bold markdown for simple display
    const renderText = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <span key={index} className="font-bold text-gray-900">{part.slice(2, -2)}</span>;
            }
            return <span key={index}>{part}</span>;
        });
    };

    return (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-1 shadow-sm border border-indigo-100 mb-6">
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5">
                <div className="flex items-start gap-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-2 text-white shadow-md shrink-0">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide mb-1 flex items-center gap-2">
                            AI Smart Summary
                            <span className="bg-indigo-100 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full border border-indigo-200">Beta</span>
                        </h3>
                        <p className="text-gray-700 text-sm leading-relaxed">
                            {renderText(summary)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
