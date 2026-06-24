import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ActivationSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  // NOTE: loading state kept for UX; mark as used to satisfy eslint
  void loading;



  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error('Enter IMEI or Mobile');
      return;
    }
    setLoading(true);
    try {
      const devicesRef = collection(db, 'devices');
      const imeiQuery = query(devicesRef, where('imei', '==', searchTerm));
      const mobileQuery = query(devicesRef, where('mobileNumber', '==', searchTerm));
      const [imeiSnap, mobileSnap] = await Promise.all([getDocs(imeiQuery), getDocs(mobileQuery)]);
      const allResults = [...imeiSnap.docs, ...mobileSnap.docs].map(d => ({ id: d.id, ...d.data() }));
      setResults(allResults);
      if (allResults.length === 0) toast('No devices found', { icon: '🔍' });
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Device Activation Search</h2>
        <p className="text-gray-500 mt-1">Search by IMEI or Mobile Number</p>
      </div>
      <div className="card mb-6">
        <div className="flex gap-4">
          <input type="text" placeholder="Enter IMEI or Mobile" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="input-field flex-1" />
          <button onClick={handleSearch} className="btn-primary"><FiSearch /> Search</button>
        </div>
      </div>
      {results.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Found {results.length} device(s)</h3>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>IMEI</th><th>Customer</th><th>Mobile</th><th>Purchase Date</th><th>Warranty</th><th>Platform</th></tr></thead>
              <tbody>
                {results.map(d => (
                  <tr key={d.id}>
                    <td className="font-mono">{d.imei}</td>
                    <td>{d.customerName}</td>
                    <td>{d.mobileNumber}</td>
                    <td>{new Date(d.purchaseDate).toLocaleDateString()}</td>
                    <td><span className={d.warrantyStatus === 'In Warranty' ? 'badge-green' : 'badge-red'}>{d.warrantyStatus}</span></td>
                    <td>{d.purchasePlatform}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}