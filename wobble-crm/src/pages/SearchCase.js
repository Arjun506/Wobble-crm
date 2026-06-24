import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiSearch, FiEye } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function SearchCase() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();



  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error('Enter search term');
      return;
    }
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'cases'));
      const allCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = allCases.filter(c => 
        c.jobId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.mobileNumber?.includes(searchTerm) ||
        c.imei1?.includes(searchTerm) ||
        c.alternateNumber?.includes(searchTerm)
      );
      setResults(filtered);
      if (filtered.length === 0) toast('No cases found', { icon: '🔍' });
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      'Open': 'badge-green',
      'Closed': 'badge-gray',
      'In Progress': 'badge-yellow',
      'Pending Approval': 'badge-orange',
      'Part Dispatch Pending': 'badge-indigo',
      'Part Dispatched': 'badge-blue',
      'Part Received': 'badge-purple',
      'Repair Done': 'badge-teal',
      'Mobile Handover to Customer': 'badge-pink',
    };
    return map[status] || 'badge-gray';
  };

  const handleViewCase = (caseId) => {
    navigate(`/case/${caseId}`);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Search Cases</h2>
        <p className="text-gray-500 mt-1">Search by Mobile / IMEI / Job ID / Alternate Number</p>
      </div>
      <div className="card mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Enter search term"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="input-field flex-1"
          />
          <button onClick={handleSearch} disabled={loading} className="btn-primary">
            {loading ? 'Searching...' : <><FiSearch /> Search</>}
          </button>
        </div>
      </div>
      {loading && <div className="flex justify-center py-8"><div className="loading-spinner"></div></div>}
      {!loading && results.length > 0 && (
        <div className="card animate-fadeIn">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Found {results.length} case(s)</h3>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Status</th>
                  <th>Device</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono text-sm">{c.jobId}</td>
                    <td>{c.customerName}</td>
                    <td>{c.mobileNumber}</td>
                    <td><span className={getStatusBadge(c.jobStatus)}>{c.jobStatus}</span></td>
                    <td>{c.deviceModel || 'N/A'}</td>
                    <td><button onClick={() => handleViewCase(c.id)} className="text-blue-600 hover:text-blue-800"><FiEye /> View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && searchTerm && results.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-500">No cases found for "{searchTerm}"</p>
        </div>
      )}
    </div>
  );
}

