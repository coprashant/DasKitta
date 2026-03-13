import React, { useEffect, useState } from 'react';
import { fetchAccounts } from '../api/client';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const [accounts, setAccounts] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        // Load stored accounts on mount
        fetchAccounts()
            .then(res => setAccounts(res.data))
            .catch(err => console.error("Failed to load accounts", err));
    }, []);

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">MeroShare Multi-Manager</h1>
                <button 
                    onClick={() => navigate('/apply')}
                    className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
                >
                    Go to Bulk Apply
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 border-b">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">DPID</th>
                            <th className="p-4">BOID</th>
                            <th className="p-4">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.map((acc) => (
                            <tr key={acc.id} className="border-b hover:bg-gray-50">
                                <td className="p-4 font-medium">{acc.name}</td>
                                <td className="p-4 text-gray-600">{acc.dpid}</td>
                                <td className="p-4 text-gray-600">{acc.boid}</td>
                                <td className="p-4">
                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                        Ready
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Dashboard;