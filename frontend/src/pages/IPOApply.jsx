import React, { useState } from 'react';
import { applyIPO } from '../api/client';

const IPOApply = () => {
    const [companyName, setCompanyName] = useState('');
    const [quantity, setQuantity] = useState(10);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleBulkApply = async () => {
        setLoading(true);
        setProgress(10); // Start progress

        try {
            // Trigger the sequential automation backend
            const response = await applyIPO({ ipoDetails: { companyName, quantity } });
            
            // In a real app, you might use WebSockets for real-time progress.
            // Here, we simulate completion based on the response.
            setProgress(100);
            alert(`Process Completed! Success: ${response.data.results.filter(r => r.success).length}`);
        } catch (err) {
            alert("Automation failed. Check backend logs.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto mt-10 p-6 bg-white shadow-xl rounded-xl">
            <h2 className="text-xl font-bold mb-4">Bulk IPO Application</h2>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Target Company Name (Exact as per MeroShare)</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded mt-1"
                        placeholder="e.g. Upper Tamakoshi"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium">Quantity (Kitta)</label>
                    <input 
                        type="number" 
                        className="w-full border p-2 rounded mt-1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                    />
                </div>

                {loading && (
                    <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
                        <div 
                            className="bg-blue-600 h-4 rounded-full transition-all duration-500" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                )}

                <button 
                    disabled={loading || !companyName}
                    onClick={handleBulkApply}
                    className={`w-full py-3 rounded text-white font-bold ${loading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {loading ? 'Processing 10 Accounts...' : 'Start Bulk Application'}
                </button>
            </div>
        </div>
    );
};

export default IPOApply;