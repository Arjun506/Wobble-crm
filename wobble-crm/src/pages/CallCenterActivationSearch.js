import React, { useState } from 'react';

import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function CallCenterActivationSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchDevice = async () => {
    if (!searchTerm.trim()) {
      toast.error('Enter search term');
      return;
    }
    setLoading(true);
    try {
      const devicesRef = collection(db, 'devices');
      const q = query(devicesRef, where('imei', '==', searchTerm.trim()));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        const q2 = query(devicesRef, where('mobileNumber', '==', searchTerm.trim()));
        const snap2 = await getDocs(q2);
        setDevices(snap2.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setDevices(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Activation Search</h2>
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Enter IMEI or Mobile"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="input-field flex-1"
          onKeyPress={e => e.key === 'Enter' && searchDevice()}
        />
        <button onClick={searchDevice} disabled={loading} className="btn-primary">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      {devices.length === 0 && !loading && <p className="text-gray-500 text-center py-8">No devices found</p>}
      {devices.map(device => (
        <div key={device.id} className="card mb-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">IMEI:</span> <span className="font-mono">{device.imei}</span></div>
            <div><span className="text-gray-500">Model:</span> {device.deviceModel || 'N/A'}</div>
            <div><span className="text-gray-500">Customer:</span> {device.customerName || 'N/A'}</div>
            <div><span className="text-gray-500">Mobile:</span> {device.mobileNumber || 'N/A'}</div>
            <div><span className="text-gray-500">Warranty:</span> <span className={device.warrantyStatus?.includes('In') ? 'text-green-600' : 'text-red-500'}>{device.warrantyStatus || 'Unknown'}</span></div>
            <div><span className="text-gray-500">Expiry:</span> {device.warrantyExpiry ? new Date(device.warrantyExpiry).toLocaleDateString() : 'N/A'}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

