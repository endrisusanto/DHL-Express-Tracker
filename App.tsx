
import React, { useState, useEffect } from 'react';
import { Search, PackageX, ShieldAlert, Eye, Trash2, Plus, ArrowLeft, Clock, User, CheckSquare, Square, RefreshCw, BarChart3, Truck, CheckCircle2, AlertTriangle, ArrowRight, X, UserPlus, Check, History, FileText, Activity } from 'lucide-react';
import { trackShipment } from './services/dhl';
import { TrackedShipment, LogEntry, LogAction } from './types';
import { ShipmentCard } from './components/ShipmentCard';
import { Timeline } from './components/Timeline';
import { AiSummary } from './components/AiSummary';

// Helper to get API URL based on environment
const getApiUrl = () => {
    // Always use relative path since React and PHP are served by same nginx server in Docker
    return '/api/shipments.php';
};

const App: React.FC = () => {
    const [trackingInput, setTrackingInput] = useState('');

    // --- SHIPMENTS STATE ---
    const [shipments, setShipments] = useState<TrackedShipment[]>([]);

    // --- ACTIVITY LOG STATE ---
    const [activityLogs, setActivityLogs] = useState<LogEntry[]>([]);

    const [viewMode, setViewMode] = useState<'dashboard' | 'detail' | 'activity'>('dashboard');
    const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [isRefreshingAll, setIsRefreshingAll] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Temp state for adding new PIC
    const [tempPicInput, setTempPicInput] = useState<{ [key: string]: string }>({});

    // --- PERSISTENCE (DB) ---

    const loadDataFromDB = async () => {
        try {
            const res = await fetch(getApiUrl());

            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                // Only warn if we expected JSON. This prevents noise on initial docker load if DB isn't ready.
                return;
            }

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const data = await res.json();

            // API returns array of shipments directly
            if (Array.isArray(data)) {
                // Map database shipments to TrackedShipment format
                const mappedShipments = data
                    .filter((dbShipment: any) => dbShipment.shipment_data) // Skip entries without shipment_data
                    .map((dbShipment: any) => {
                        try {
                            // Parse stored JSON data
                            const shipmentData = typeof dbShipment.shipment_data === 'string'
                                ? JSON.parse(dbShipment.shipment_data)
                                : dbShipment.shipment_data;

                            // Validate that shipmentData has required fields
                            if (!shipmentData || !shipmentData.id || !shipmentData.status) {
                                console.warn('Invalid shipment data:', dbShipment.tracking_number);
                                return null;
                            }

                            return {
                                ...shipmentData,
                                id: dbShipment.tracking_number,
                                pic: Array.isArray(shipmentData?.pic) ? shipmentData.pic : [],
                                isCollected: shipmentData?.isCollected || false,
                                collectedAt: shipmentData?.collectedAt
                            };
                        } catch (err) {
                            console.error('Error parsing shipment:', dbShipment.tracking_number, err);
                            return null;
                        }
                    })
                    .filter((s: any) => s !== null); // Remove null entries from failed parses

                setShipments(mappedShipments);
            }
        } catch (err) {
            console.error("Failed to load shipments from DB:", err);
            // Don't show heavy error UI on load, just log it. 
            // The user will realize connectivity issues if they try to add/update.
        }
    };

    const loadLogsFromDB = async () => {
        try {
            const res = await fetch('/api/logs.php');
            if (!res.ok) return;

            const logs = await res.json();
            if (Array.isArray(logs)) {
                const mappedLogs = logs.map((log: any) => ({
                    id: log.log_id,
                    timestamp: log.timestamp,
                    action: log.action as LogAction,
                    description: log.description,
                    relatedShipmentId: log.related_shipment_id
                }));
                setActivityLogs(mappedLogs);
            }
        } catch (err) {
            console.error("Failed to load logs from DB:", err);
        }
    };

    useEffect(() => {
        loadDataFromDB();
        loadLogsFromDB();
    }, []);

    const saveShipmentToDB = async (shipment: TrackedShipment) => {
        try {
            // Serialize the entire shipment object as JSON
            const payload = {
                tracking_number: shipment.id,
                status: shipment.status?.description || 'Unknown',
                origin: shipment.origin?.address?.addressLocality || 'Unknown',
                destination: shipment.destination?.address?.addressLocality || 'Unknown',
                estimated_delivery: null, // Can be updated if needed
                shipment_data: JSON.stringify(shipment) // Store full shipment data
            };

            console.log('Saving shipment to DB:', shipment.id, payload);

            const response = await fetch(getApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to save shipment:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('Shipment saved successfully:', result);
        } catch (e) {
            console.error("Save failed for", shipment.id, e);
        }
    };

    const deleteShipmentFromDB = async (id: string) => {
        try {
            await fetch(`${getApiUrl()}?tracking_number=${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });
        } catch (e) { console.error("Delete failed", e); }
    };

    const saveLogToDB = async (log: LogEntry) => {
        try {
            // Convert ISO string to MySQL datetime format (YYYY-MM-DD HH:MM:SS)
            // Note: This stores UTC time in the database
            const date = new Date(log.timestamp);
            const mysqlTimestamp = date.toISOString().slice(0, 19).replace('T', ' ');

            const payload = {
                log_id: log.id,
                timestamp: mysqlTimestamp,
                action: log.action,
                description: log.description,
                related_shipment_id: log.relatedShipmentId || null
            };

            const response = await fetch('/api/logs.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to save log:', response.status, errorText);
            }
        } catch (e) {
            console.error("Failed to save log to DB:", e);
        }
    };

    // --- LOGGING HELPER ---
    const addLog = (action: LogAction, description: string, relatedShipmentId?: string) => {
        const newLog: LogEntry = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            action,
            description,
            relatedShipmentId
        };
        setActivityLogs(prev => [newLog, ...prev]);
        // Save log to database for persistence
        saveLogToDB(newLog);
    };

    // --- STATISTICS ---
    const stats = {
        total: shipments.length,
        transit: shipments.filter(s => s.status.statusCode === 'transit' || s.status.statusCode === 'pre_transit').length,
        delivered: shipments.filter(s => s.status.statusCode === 'delivered').length,
        exception: shipments.filter(s => ['failure', 'unknown', 'exception'].includes(s.status.statusCode)).length,
        collected: shipments.filter(s => s.isCollected).length
    };

    // --- ACTIONS ---

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trackingInput.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const rawInputs = trackingInput.split(/[\s,]+/).map(s => s.trim()).filter(s => s.length > 0);
            const uniqueInputs = Array.from(new Set<string>(rawInputs));

            // Filter already tracked
            const trackingNumbers = uniqueInputs.filter(num => !shipments.some(s => s.id === num));

            if (trackingNumbers.length === 0) {
                if (uniqueInputs.length > 0) {
                    setError("All entered tracking numbers are already in your list.");
                }
                setLoading(false);
                return;
            }

            setTrackingInput('');

            // Using a 'for...of' loop with non-blocking DB saves
            // We process tracking sequentially to avoid 429, but we don't wait for DB.
            for (const num of trackingNumbers) {
                try {
                    // 1. Track
                    const data = await trackShipment(num);

                    const newShipment: TrackedShipment = {
                        ...data,
                        pic: [],
                        isCollected: false,
                        collectedAt: undefined
                    };

                    // 2. Update State
                    setShipments(prev => {
                        if (prev.some(s => s.id === newShipment.id)) return prev;
                        return [newShipment, ...prev];
                    });

                    addLog('ADD_SHIPMENT', `Added new shipment ${num}`, num);

                    // 3. DB Save (Fire & Forget)
                    saveShipmentToDB(newShipment);

                    // 4. Rate Limit Delay
                    await new Promise(resolve => setTimeout(resolve, 1200));

                } catch (err: any) {
                    console.error(`Error tracking ${num}:`, err);
                    // We continue to the next number even if one fails
                    // But we might want to show a toast or error status later
                }
            }

        } catch (err: any) {
            console.error("Search critical error:", err);
            setError("An error occurred while processing. Check console.");
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshAll = async () => {
        if (shipments.length === 0) return;
        setIsRefreshingAll(true);
        setError(null);

        const updatedShipments: TrackedShipment[] = [];
        const errors: string[] = [];
        let updateCount = 0;

        try {
            // Clone existing to avoid mutation issues
            const currentList = [...shipments];

            for (const existing of currentList) {
                try {
                    const freshData = await trackShipment(existing.id);

                    if (freshData.status.statusCode !== existing.status.statusCode) {
                        addLog('UPDATE_STATUS', `Status changed to ${freshData.status.description}`, existing.id);
                    }

                    const updated: TrackedShipment = {
                        ...freshData,
                        pic: existing.pic,
                        isCollected: existing.isCollected,
                        collectedAt: existing.collectedAt
                    };

                    updatedShipments.push(updated);
                    saveShipmentToDB(updated);
                    updateCount++;

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err: any) {
                    updatedShipments.push(existing); // Keep old data if update fails
                    errors.push(`Update failed for ${existing.id}`);
                }
            }
            setShipments(updatedShipments);
            addLog('BULK_UPDATE', `Refreshed status for ${updateCount} shipments`);

        } finally {
            setIsRefreshingAll(false);
        }
    };

    const addPic = (id: string) => {
        const nameToAdd = tempPicInput[id]?.trim();
        if (!nameToAdd) return;

        setShipments(prev => prev.map(s => {
            if (s.id === id) {
                if (s.pic.includes(nameToAdd)) return s;
                addLog('ADD_PIC', `Assigned PIC: ${nameToAdd}`, id);
                const updated = { ...s, pic: [...s.pic, nameToAdd] };
                saveShipmentToDB(updated);
                return updated;
            }
            return s;
        }));

        setTempPicInput(prev => ({ ...prev, [id]: '' }));
    };

    const removePic = (id: string, nameToRemove: string) => {
        addLog('REMOVE_PIC', `Removed PIC: ${nameToRemove}`, id);
        setShipments(prev => prev.map(s => {
            if (s.id === id) {
                const updated = { ...s, pic: s.pic.filter(name => name !== nameToRemove) };
                saveShipmentToDB(updated);
                return updated;
            }
            return s;
        }));
    };

    const handlePicInputChange = (id: string, value: string) => {
        setTempPicInput(prev => ({ ...prev, [id]: value }));
    };

    const handlePicKeyDown = (e: React.KeyboardEvent, id: string) => {
        if (e.key === 'Enter') {
            addPic(id);
        }
    };

    const toggleCollected = (id: string) => {
        setShipments(prev => prev.map(s => {
            if (s.id === id) {
                const isNowCollected = !s.isCollected;
                addLog(
                    isNowCollected ? 'MARK_COLLECTED' : 'MARK_UNCOLLECTED',
                    isNowCollected ? 'Marked as collected' : 'Reverted collection status',
                    id
                );
                const updated = {
                    ...s,
                    isCollected: isNowCollected,
                    collectedAt: isNowCollected ? new Date().toISOString() : undefined
                };
                saveShipmentToDB(updated);
                return updated;
            }
            return s;
        }));
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Remove this shipment from tracking list?')) {
            addLog('DELETE_SHIPMENT', `Deleted shipment ${id}`, id);
            setShipments(prev => prev.filter(s => s.id !== id));
            deleteShipmentFromDB(id);
            if (selectedShipmentId === id) {
                setViewMode('dashboard');
                setSelectedShipmentId(null);
            }
        }
    };

    const handleView = (id: string) => {
        setSelectedShipmentId(id);
        setViewMode('detail');
    };

    const getStatusColor = (status: string) => {
        const s = status.toLowerCase();
        if (s.includes('delivered')) return 'bg-green-100 text-green-700 border-green-200';
        if (s.includes('transit')) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (s.includes('exception') || s.includes('hold') || s.includes('delay')) return 'bg-red-100 text-red-700 border-red-200';
        return 'bg-gray-100 text-gray-700 border-gray-200';
    };

    const getActionIcon = (action: LogAction) => {
        switch (action) {
            case 'ADD_SHIPMENT': return <Plus size={14} className="text-blue-600" />;
            case 'DELETE_SHIPMENT': return <Trash2 size={14} className="text-red-600" />;
            case 'ADD_PIC': return <UserPlus size={14} className="text-indigo-600" />;
            case 'REMOVE_PIC': return <User size={14} className="text-gray-500" />;
            case 'MARK_COLLECTED': return <CheckCircle2 size={14} className="text-green-600" />;
            case 'MARK_UNCOLLECTED': return <Square size={14} className="text-orange-600" />;
            case 'UPDATE_STATUS': return <Truck size={14} className="text-yellow-600" />;
            case 'BULK_UPDATE': return <RefreshCw size={14} className="text-gray-600" />;
            default: return <Activity size={14} className="text-gray-600" />;
        }
    };

    const activeShipment = shipments.find(s => s.id === selectedShipmentId);

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
            {/* Header */}
            <header className="bg-dhl-yellow shadow-md sticky top-0 z-50">
                <div className="w-full max-w-[98%] mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setViewMode('dashboard')}>
                        <div className="bg-dhl-red text-white font-black italic text-2xl px-3 py-1 transform -skew-x-12 shadow-sm select-none">
                            DHL
                        </div>
                        <span className="font-bold text-dhl-red text-xl tracking-tight hidden sm:inline">Express Manager</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setViewMode('activity')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 transition-colors ${viewMode === 'activity' ? 'bg-dhl-red text-white' : 'bg-white/40 text-dhl-red hover:bg-white/60'}`}
                        >
                            <History size={14} /> Activity Log
                        </button>
                        <div className="text-xs font-bold text-dhl-red/80 uppercase tracking-wider bg-white/20 px-2 py-1 rounded hidden md:block">
                            Tracking Dashboard
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow w-full max-w-[98%] mx-auto px-4 py-6">

                {/* --- DASHBOARD VIEW --- */}
                {viewMode === 'dashboard' && (
                    <div className="animate-in fade-in duration-500 flex flex-col gap-6">

                        {/* Stats Row */}
                        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                <div>
                                    <p className="text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Total</p>
                                    <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.total}</p>
                                </div>
                                <div className="bg-gray-100 p-1.5 md:p-2 rounded-lg text-gray-600 w-fit"><PackageX size={18} /></div>
                            </div>
                            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                <div>
                                    <p className="text-blue-600 text-[10px] md:text-xs font-bold uppercase tracking-wider">In Transit</p>
                                    <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.transit}</p>
                                </div>
                                <div className="bg-blue-50 p-1.5 md:p-2 rounded-lg text-blue-600 w-fit"><Truck size={18} /></div>
                            </div>
                            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                <div>
                                    <p className="text-green-600 text-[10px] md:text-xs font-bold uppercase tracking-wider">Delivered</p>
                                    <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.delivered}</p>
                                </div>
                                <div className="bg-green-50 p-1.5 md:p-2 rounded-lg text-green-600 w-fit"><CheckCircle2 size={18} /></div>
                            </div>
                            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                <div>
                                    <p className="text-red-600 text-[10px] md:text-xs font-bold uppercase tracking-wider">Exceptions</p>
                                    <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.exception}</p>
                                </div>
                                <div className="bg-red-50 p-1.5 md:p-2 rounded-lg text-red-600 w-fit"><AlertTriangle size={18} /></div>
                            </div>
                            <div className="col-span-2 lg:col-span-1 bg-white p-3 md:p-4 rounded-xl shadow-sm border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-2 ring-1 ring-indigo-50">
                                <div>
                                    <p className="text-indigo-600 text-[10px] md:text-xs font-bold uppercase tracking-wider">Collected (Internal)</p>
                                    <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.collected}</p>
                                </div>
                                <div className="bg-indigo-50 p-1.5 md:p-2 rounded-lg text-indigo-600 w-fit"><CheckSquare size={18} /></div>
                            </div>
                        </section>

                        {/* Search / Input Area */}
                        <section className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Plus size={16} className="text-dhl-red" />
                                Add New Shipments (Comma separated)
                            </label>

                            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 w-full">
                                <div className="flex-grow relative">
                                    <input
                                        type="text"
                                        value={trackingInput}
                                        onChange={(e) => setTrackingInput(e.target.value)}
                                        placeholder="e.g. 123456, 789012"
                                        className="w-full px-4 py-2 text-base bg-gray-800 text-white placeholder-gray-400 border border-gray-700 rounded-lg focus:ring-2 focus:ring-dhl-red focus:border-dhl-red outline-none transition-all shadow-sm"
                                    />
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0 h-10 md:h-auto">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="bg-dhl-red hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap disabled:opacity-70 h-full flex-1 md:flex-none justify-center"
                                    >
                                        {loading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <><Search size={18} /> Track</>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleRefreshAll}
                                        disabled={isRefreshingAll || shipments.length === 0}
                                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 h-full whitespace-nowrap flex-1 md:flex-none justify-center"
                                    >
                                        <RefreshCw size={16} className={isRefreshingAll ? "animate-spin" : ""} />
                                        Update All
                                    </button>
                                </div>
                            </form>

                            {error && (
                                <div className="mt-4 bg-red-50 border border-red-100 text-red-700 px-4 py-2 rounded-lg text-sm flex items-start gap-2">
                                    <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </section>

                        {/* Dashboard Content */}
                        {shipments.length === 0 ? (
                            <div className="bg-white p-12 text-center flex flex-col items-center justify-center h-64 rounded-xl border border-gray-100 shadow-sm">
                                <PackageX size={48} className="mb-4 text-gray-300" />
                                <h3 className="text-lg font-semibold text-gray-600">Dashboard Empty</h3>
                                <p className="text-gray-400 mt-1">Add tracking numbers to start monitoring.</p>
                            </div>
                        ) : (
                            <>
                                {/* Mobile Card View (< md) */}
                                <div className="md:hidden grid grid-cols-1 gap-4">
                                    {shipments.map(item => (
                                        <div key={item.id} className={`bg-white p-4 rounded-xl shadow-sm border border-gray-200 relative transition-all ${item.isCollected ? 'bg-gray-50/80 border-l-4 border-l-green-500' : ''}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg font-black text-dhl-red font-mono">{item.id}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 truncate max-w-[180px]">{item.details?.product?.productName || item.service}</div>
                                                    <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                                        <Clock size={10} />
                                                        {item.status.timestamp ? new Date(item.status.timestamp).toLocaleDateString() : '-'}
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-1 text-[10px] font-bold rounded-full border ${getStatusColor(item.status.description)}`}>
                                                    {item.status.description}
                                                </span>
                                            </div>

                                            <div className="bg-gray-50 p-3 rounded-lg mb-4 border border-gray-100">
                                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                                    <span className="font-medium truncate">{item.origin.address.addressLocality}</span>
                                                    <ArrowRight size={14} className="text-gray-400 shrink-0" />
                                                    <span className="font-medium truncate">{item.destination.address.addressLocality}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1 truncate">
                                                    {item.events[0]?.description}
                                                </div>
                                            </div>

                                            {/* PIC Mobile */}
                                            <div className="mb-3">
                                                <div className="flex flex-wrap gap-1.5 mb-2">
                                                    {item.pic.map((p, idx) => (
                                                        <span key={idx} className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                                                            {p}
                                                            <button onClick={() => removePic(item.id, p)} className="ml-1 hover:text-indigo-900"><X size={10} /></button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="relative">
                                                    <UserPlus size={14} className="absolute left-2 top-2 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={tempPicInput[item.id] || ''}
                                                        onChange={(e) => handlePicInputChange(item.id, e.target.value)}
                                                        onKeyDown={(e) => handlePicKeyDown(e, item.id)}
                                                        placeholder="Add PIC + Enter"
                                                        className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-800 text-white placeholder-gray-400 border border-gray-700 rounded-md focus:ring-1 focus:ring-dhl-red outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                                                <button
                                                    onClick={() => toggleCollected(item.id)}
                                                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold border transition-all duration-300 ${item.isCollected
                                                        ? 'bg-green-500 border-green-600 text-white shadow-inner'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm'
                                                        }`}
                                                >
                                                    {item.isCollected ? <CheckCircle2 size={16} className="animate-bounce" /> : <Square size={16} />}
                                                    {item.isCollected ? 'COLLECTED' : 'Mark Done'}
                                                </button>

                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleView(item.id)}
                                                        className="text-dhl-red hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table View (>= md) */}
                                <div className="hidden md:block bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 overflow-x-auto">
                                    <table className="w-full min-w-[1000px] border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-64">AWB Info</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">DHL Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Route</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Collection</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-80">PIC Team</th>
                                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24 sticky right-0 z-20 bg-gray-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {shipments.map((item) => (
                                                <tr key={item.id} className={`group transition-colors ${item.isCollected ? 'bg-green-50/30' : 'hover:bg-yellow-50/30'}`}>
                                                    {/* AWB INFO */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg font-black text-dhl-red font-mono">{item.id}</span>
                                                            </div>
                                                            <span className="text-xs text-gray-500 truncate max-w-[200px]">{item.details?.product?.productName || item.service}</span>
                                                            <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                                                <Clock size={10} />
                                                                {item.status.timestamp ? new Date(item.status.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* STATUS */}
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 inline-flex text-xs leading-4 font-bold rounded-full border ${getStatusColor(item.status.description)}`}>
                                                            {item.status.description}
                                                        </span>
                                                    </td>

                                                    {/* ROUTE */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-sm text-gray-700">
                                                            <span className="font-medium whitespace-nowrap">{item.origin.address.addressLocality}</span>
                                                            <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                                                            <span className="font-medium whitespace-nowrap">{item.destination.address.addressLocality}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-500 truncate max-w-[250px] mt-1">
                                                            {item.events[0]?.description}
                                                        </div>
                                                    </td>

                                                    {/* COLLECTION STATUS (ANIMATED) */}
                                                    <td className="px-6 py-4">
                                                        <button
                                                            onClick={() => toggleCollected(item.id)}
                                                            className={`group relative w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all duration-300 overflow-hidden ${item.isCollected
                                                                ? 'bg-green-500 border-green-600 text-white shadow-sm hover:shadow-md active:scale-95'
                                                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 active:scale-95'
                                                                }`}
                                                        >
                                                            <div className={`transition-transform duration-300 ${item.isCollected ? 'scale-100' : 'scale-75 opacity-50 group-hover:scale-100'}`}>
                                                                {item.isCollected ? <CheckCircle2 size={16} /> : <Square size={16} />}
                                                            </div>
                                                            <span>{item.isCollected ? 'COLLECTED' : 'Mark Done'}</span>

                                                            {/* Sparkle Effect on Collected */}
                                                            {item.isCollected && (
                                                                <span className="absolute inset-0 bg-white/20 animate-ping opacity-0 group-active:opacity-100 rounded-lg"></span>
                                                            )}
                                                        </button>
                                                        {item.collectedAt && (
                                                            <div className="text-[10px] text-center text-gray-400 mt-1 font-mono">
                                                                {new Date(item.collectedAt).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* PIC ASSIGNMENT (MULTIPLE) */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.pic.length === 0 && <span className="text-[10px] text-gray-400 italic">No PIC</span>}
                                                            {item.pic.map((p, idx) => (
                                                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo-100 text-indigo-700 border border-indigo-200 group/pic hover:bg-indigo-200 transition-colors cursor-default">
                                                                    {p}
                                                                    <button
                                                                        onClick={() => removePic(item.id, p)}
                                                                        className="ml-1 text-indigo-400 hover:text-indigo-900 opacity-0 group-hover/pic:opacity-100 transition-opacity"
                                                                    >
                                                                        <X size={10} strokeWidth={3} />
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>

                                                    {/* ACTIONS */}
                                                    <td className={`px-6 py-4 whitespace-nowrap text-right sticky right-0 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] ${item.isCollected ? 'bg-green-50' : 'bg-white group-hover:bg-yellow-50'}`}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => handleView(item.id)}
                                                                className="text-gray-400 hover:text-dhl-red hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                                title="View Full Details"
                                                            >
                                                                <Eye size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(item.id)}
                                                                className="text-gray-300 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                                title="Remove"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* --- ACTIVITY LOG VIEW --- */}
                {viewMode === 'activity' && (
                    <div className="animate-in slide-in-from-right-4 duration-300 max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <button
                                onClick={() => setViewMode('dashboard')}
                                className="flex items-center gap-2 text-gray-600 hover:text-dhl-red font-medium transition-colors px-4 py-2 rounded-lg hover:bg-gray-100 w-fit"
                            >
                                <ArrowLeft size={20} /> Back to Dashboard
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                <FileText size={20} /> System Activity Log
                            </h3>

                            {activityLogs.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <History size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>No activity recorded yet.</p>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gray-100"></div>
                                    <div className="space-y-6">
                                        {activityLogs.map((log) => (
                                            <div key={log.id} className="relative flex gap-4">
                                                <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                                                    {getActionIcon(log.action)}
                                                </div>
                                                <div className="flex-1 pb-4 border-b border-gray-50 last:border-0">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-sm font-bold text-gray-800">
                                                            {log.description}
                                                        </span>
                                                        <span className="text-xs text-gray-400 font-mono whitespace-nowrap ml-2">
                                                            {new Date(log.timestamp).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    {log.relatedShipmentId && (
                                                        <div className="text-xs text-indigo-500 mt-1 font-mono">
                                                            Ref: {log.relatedShipmentId}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- DETAIL VIEW --- */}
                {viewMode === 'detail' && activeShipment && (
                    <div className="animate-in slide-in-from-right-4 duration-300 max-w-6xl mx-auto">
                        <button
                            onClick={() => setViewMode('dashboard')}
                            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-dhl-red font-medium transition-colors px-4 py-2 rounded-lg hover:bg-gray-100 w-fit"
                        >
                            <ArrowLeft size={20} /> Back to Dashboard
                        </button>

                        {/* LAYOUT FIX: Ensure both cards match height using items-stretch and h-full */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-stretch">
                            <div className="lg:col-span-2 h-full">
                                <ShipmentCard shipment={activeShipment} />
                            </div>
                            <div className="lg:col-span-1 h-full">
                                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 h-full flex flex-col">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <User size={16} /> Internal Team
                                    </h3>

                                    <div className="space-y-6 flex-grow">
                                        {/* PIC Section */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Assigned PICs</label>

                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {activeShipment.pic.length === 0 && (
                                                    <span className="text-sm text-gray-400 italic">No one assigned yet.</span>
                                                )}
                                                {activeShipment.pic.map((p, idx) => (
                                                    <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-100 shadow-sm">
                                                        {p}
                                                        <button
                                                            onClick={() => removePic(activeShipment.id, p)}
                                                            className="ml-2 bg-indigo-200 rounded-full p-0.5 hover:bg-indigo-300 text-indigo-800 transition-colors"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>

                                            <div className="relative">
                                                <UserPlus size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={tempPicInput[activeShipment.id] || ''}
                                                    onChange={(e) => handlePicInputChange(activeShipment.id, e.target.value)}
                                                    onKeyDown={(e) => handlePicKeyDown(e, activeShipment.id)}
                                                    className="w-full pl-9 pr-10 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-dhl-red outline-none text-sm bg-gray-800 text-white placeholder-gray-400"
                                                    placeholder="Type name & Press Enter..."
                                                />
                                                <button
                                                    onClick={() => addPic(activeShipment.id)}
                                                    className="absolute right-2 top-2 text-gray-400 hover:text-dhl-red"
                                                >
                                                    <Plus size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Collection Section */}
                                        <div className="pt-6 border-t border-gray-100 mt-auto">
                                            <button
                                                onClick={() => toggleCollected(activeShipment.id)}
                                                className={`w-full group relative flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold border-2 transition-all duration-300 overflow-hidden ${activeShipment.isCollected
                                                    ? 'bg-green-500 border-green-500 text-white shadow-lg scale-100'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className={`p-1 rounded-full transition-all duration-300 ${activeShipment.isCollected ? 'bg-white/20' : 'bg-gray-100'}`}>
                                                    {activeShipment.isCollected ? <Check size={20} strokeWidth={4} /> : <Square size={20} />}
                                                </div>

                                                <div className="flex flex-col items-start">
                                                    <span className="text-base leading-tight">
                                                        {activeShipment.isCollected ? 'ITEM COLLECTED' : 'MARK AS COLLECTED'}
                                                    </span>
                                                    {activeShipment.collectedAt && (
                                                        <span className={`text-[10px] font-normal ${activeShipment.isCollected ? 'text-green-100' : 'text-gray-400'}`}>
                                                            On {new Date(activeShipment.collectedAt).toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <AiSummary shipment={activeShipment} />
                        <Timeline events={activeShipment.events} />
                    </div>
                )}

            </main>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-6 mt-auto">
                <div className="w-full max-w-[98%] mx-auto px-4 text-center text-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <p>&copy; {new Date().getFullYear()} DHL Express Internal Manager.</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1">
                        <BarChart3 size={12} /> Local Data Only
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default App;
