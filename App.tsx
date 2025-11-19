import React, { useState, useEffect } from 'react';
import { Search, PackageX, ShieldAlert, ArrowRight, Eye, Trash2, Plus, ArrowLeft, Clock, User, CheckSquare, Square, RefreshCw, BarChart3, Truck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { trackShipment, getMockShipment } from './services/dhl';
import { DHLShipment, TrackedShipment } from './types';
import { ShipmentCard } from './components/ShipmentCard';
import { Timeline } from './components/Timeline';
import { AIAnalysis } from './components/AIAnalysis';

const App: React.FC = () => {
  const [trackingInput, setTrackingInput] = useState('');
  // State to hold multiple shipments with extended local data
  const [shipments, setShipments] = useState<TrackedShipment[]>(() => {
    // Load from local storage on init
    const saved = localStorage.getItem('dhl_tracker_shipments');
    return saved ? JSON.parse(saved) : [];
  });

  const [viewMode, setViewMode] = useState<'dashboard' | 'detail'>('dashboard');
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save to local storage whenever shipments change
  useEffect(() => {
    localStorage.setItem('dhl_tracker_shipments', JSON.stringify(shipments));
  }, [shipments]);

  // --- STATISTICS CALCULATION ---
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

    const trackingNumbers = trackingInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    if (trackingNumbers.length === 0) {
        setLoading(false);
        return;
    }

    const newShipments: TrackedShipment[] = [];
    const errors: string[] = [];

    await Promise.all(trackingNumbers.map(async (num) => {
        if (shipments.some(s => s.id === num)) return; // Skip duplicates

        try {
            const data = await trackShipment(num);
            // Extend with local fields
            newShipments.push({
                ...data,
                pic: '',
                isCollected: false,
                collectedAt: undefined
            });
        } catch (err: any) {
            errors.push(`${num}: ${err.message}`);
        }
    }));

    if (newShipments.length > 0) {
        setShipments(prev => [...newShipments, ...prev]);
        setTrackingInput('');
    }

    if (errors.length > 0) {
        setError(`Failed: ${errors.join(' | ')}`);
    }

    setLoading(false);
  };

  const handleRefreshAll = async () => {
    if (shipments.length === 0) return;
    setIsRefreshingAll(true);
    setError(null);

    const updatedShipments: TrackedShipment[] = [];
    const errors: string[] = [];

    // We process sequentially or in small batches to avoid rate limits if list is huge, 
    // but for now Promise.all is fine for reasonable usage.
    await Promise.all(shipments.map(async (existing) => {
        try {
            const freshData = await trackShipment(existing.id);
            // Merge fresh DHL data with existing Local data (PIC, Collected status)
            updatedShipments.push({
                ...freshData,
                pic: existing.pic,
                isCollected: existing.isCollected,
                collectedAt: existing.collectedAt
            });
        } catch (err: any) {
            // Keep existing data if fetch fails
            updatedShipments.push(existing);
            errors.push(`Update failed for ${existing.id}`);
        }
    }));

    // Sort to maintain order or sort by latest update? Let's keep mostly as is but updated.
    // Currently simple replacement.
    setShipments(updatedShipments);
    
    if (errors.length > 0) {
        setError(`Some updates failed. Check connection.`);
    }
    
    setIsRefreshingAll(false);
  };

  const updatePic = (id: string, newPic: string) => {
    setShipments(prev => prev.map(s => s.id === id ? { ...s, pic: newPic } : s));
  };

  const toggleCollected = (id: string) => {
    setShipments(prev => prev.map(s => {
        if (s.id === id) {
            const isNowCollected = !s.isCollected;
            return {
                ...s,
                isCollected: isNowCollected,
                collectedAt: isNowCollected ? new Date().toISOString() : undefined
            };
        }
        return s;
    }));
  };

  const loadDemo = () => {
      setLoading(true);
      setTimeout(() => {
          const demoIds = ['1234567890', '9876543210', '5566778899'];
          const demoData = demoIds.map((id, idx) => {
              const base = getMockShipment(id);
              // Add variety
              if (idx === 1) { base.status.statusCode = 'delivered'; base.status.description = 'Delivered'; }
              if (idx === 2) { base.status.statusCode = 'exception'; base.status.description = 'Clearance Delay'; }
              
              return {
                  ...base,
                  pic: idx === 0 ? 'Budi' : '',
                  isCollected: idx === 1,
                  collectedAt: idx === 1 ? new Date().toISOString() : undefined
              } as TrackedShipment;
          });

          setShipments(prev => {
              const unique = demoData.filter(d => !prev.some(p => p.id === d.id));
              return [...unique, ...prev];
          });
          setLoading(false);
      }, 600);
  };

  const handleDelete = (id: string) => {
      if(window.confirm('Remove this shipment from tracking list?')) {
        setShipments(prev => prev.filter(s => s.id !== id));
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
          <div className="text-xs font-bold text-dhl-red/80 uppercase tracking-wider bg-white/20 px-2 py-1 rounded">
              Tracking Dashboard
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow w-full max-w-[98%] mx-auto px-4 py-6">
        
        {/* --- DASHBOARD VIEW --- */}
        {viewMode === 'dashboard' && (
            <div className="animate-in fade-in duration-500 flex flex-col gap-6">
                
                {/* Stats Row */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Shipments</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                        </div>
                        <div className="bg-gray-100 p-2 rounded-lg text-gray-600"><PackageX size={20} /></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-blue-600 text-xs font-bold uppercase tracking-wider">In Transit</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.transit}</p>
                        </div>
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Truck size={20} /></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-green-600 text-xs font-bold uppercase tracking-wider">Delivered (DHL)</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.delivered}</p>
                        </div>
                        <div className="bg-green-50 p-2 rounded-lg text-green-600"><CheckCircle2 size={20} /></div>
                    </div>
                     <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-red-600 text-xs font-bold uppercase tracking-wider">Exceptions</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.exception}</p>
                        </div>
                        <div className="bg-red-50 p-2 rounded-lg text-red-600"><AlertTriangle size={20} /></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100 flex items-center justify-between ring-1 ring-indigo-50">
                        <div>
                            <p className="text-indigo-600 text-xs font-bold uppercase tracking-wider">Collected (Internal)</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.collected}</p>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><CheckSquare size={20} /></div>
                    </div>
                </section>

                {/* Search / Input Area */}
                <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex flex-col lg:flex-row gap-4 lg:items-end justify-between">
                        <div className="flex-grow max-w-3xl">
                             <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Plus size={16} className="text-dhl-red" /> 
                                Add New Shipments (Comma separated)
                            </label>
                            <form onSubmit={handleSearch} className="relative flex gap-2">
                                <input
                                    type="text"
                                    value={trackingInput}
                                    onChange={(e) => setTrackingInput(e.target.value)}
                                    placeholder="e.g. 123456, 789012"
                                    className="w-full px-4 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-dhl-red focus:border-dhl-red outline-none transition-all shadow-sm"
                                />
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-dhl-red hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap disabled:opacity-70"
                                >
                                    {loading ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <><Search size={18} /> Track</>
                                    )}
                                </button>
                            </form>
                        </div>
                         <div className="flex gap-3">
                            <button 
                                onClick={handleRefreshAll}
                                disabled={isRefreshingAll || shipments.length === 0}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={16} className={isRefreshingAll ? "animate-spin" : ""} />
                                Update All Status
                            </button>
                             <button onClick={loadDemo} className="text-xs text-gray-400 hover:text-dhl-red underline transition-colors self-center">
                                Demo Data
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 bg-red-50 border border-red-100 text-red-700 px-4 py-2 rounded-lg text-sm flex items-start gap-2">
                            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </section>

                {/* Dashboard Table */}
                <section className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 flex-grow">
                    {shipments.length === 0 ? (
                         <div className="p-12 text-center flex flex-col items-center justify-center h-64">
                            <PackageX size={48} className="mb-4 text-gray-300" />
                            <h3 className="text-lg font-semibold text-gray-600">Dashboard Empty</h3>
                            <p className="text-gray-400 mt-1">Add tracking numbers to start monitoring.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1000px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-64">AWB Info</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">DHL Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Route</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-48">PIC Assignment</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Collection</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {shipments.map((item) => (
                                        <tr key={item.id} className={`group transition-colors ${item.isCollected ? 'bg-gray-50/50' : 'hover:bg-yellow-50/30'}`}>
                                            {/* AWB INFO */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg font-black text-dhl-red font-mono">{item.id}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-500 truncate max-w-[200px]">{item.details?.product?.productName || item.service}</span>
                                                    <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                                        <Clock size={10} />
                                                        {item.status.timestamp ? new Date(item.status.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : '-'}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* STATUS */}
                                            <td className="px-6 py-4">
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

                                            {/* PIC ASSIGNMENT */}
                                            <td className="px-6 py-4">
                                                <div className="relative flex items-center">
                                                    <User size={14} className="absolute left-2 text-gray-400 pointer-events-none" />
                                                    <input 
                                                        type="text" 
                                                        value={item.pic}
                                                        onChange={(e) => updatePic(item.id, e.target.value)}
                                                        placeholder="Assign PIC..."
                                                        className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-dhl-red focus:border-dhl-red outline-none bg-white"
                                                    />
                                                </div>
                                            </td>

                                            {/* COLLECTION STATUS */}
                                            <td className="px-6 py-4">
                                                <button 
                                                    onClick={() => toggleCollected(item.id)}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-all w-full justify-center ${
                                                        item.isCollected 
                                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
                                                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {item.isCollected ? <CheckSquare size={14} /> : <Square size={14} />}
                                                    {item.isCollected ? 'Collected' : 'Mark Done'}
                                                </button>
                                                {item.collectedAt && (
                                                    <div className="text-[10px] text-center text-gray-400 mt-1">
                                                        {new Date(item.collectedAt).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </td>

                                            {/* ACTIONS */}
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
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
                    )}
                </section>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="col-span-2">
                        <ShipmentCard shipment={activeShipment} />
                    </div>
                    <div className="col-span-1">
                         <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 h-full">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Internal Tracking</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned PIC</label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                        <input 
                                            type="text" 
                                            value={activeShipment.pic}
                                            onChange={(e) => updatePic(activeShipment.id, e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-dhl-red outline-none"
                                            placeholder="Enter name..."
                                        />
                                    </div>
                                </div>
                                
                                <div className="pt-4 border-t border-gray-100">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div 
                                            onClick={() => toggleCollected(activeShipment.id)}
                                            className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${activeShipment.isCollected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300 group-hover:border-indigo-400'}`}
                                        >
                                            {activeShipment.isCollected && <CheckSquare size={14} className="text-white" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`font-medium ${activeShipment.isCollected ? 'text-indigo-700' : 'text-gray-700'}`}>
                                                Mark as Collected
                                            </span>
                                            {activeShipment.collectedAt && (
                                                <span className="text-xs text-gray-400">
                                                    {new Date(activeShipment.collectedAt).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            </div>
                         </div>
                    </div>
                </div>

                <AIAnalysis shipment={activeShipment} />
                <Timeline events={activeShipment.events} />
            </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-6 mt-auto">
          <div className="w-full max-w-[98%] mx-auto px-4 text-center text-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <p>&copy; {new Date().getFullYear()} DHL Express Internal Manager. Demo Application.</p>
              <p className="text-xs text-gray-600 flex items-center gap-1">
                  <BarChart3 size={12} /> Local Data Persisted
              </p>
          </div>
      </footer>
    </div>
  );
};

export default App;