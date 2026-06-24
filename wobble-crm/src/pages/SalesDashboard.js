import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { FiPackage, FiCheckCircle, FiClock, FiTrendingUp, FiBox, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';
import WarrantyReceiptModal from '../components/WarrantyReceiptModal';

export default function SalesDashboard() {





  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    warrantyActive: 0,
    pendingWarranty: 0,
    approvedWarranty: 0,
    rejectedWarranty: 0,
    todayActivations: 0,
  });
  const [recentActivations, setRecentActivations] = useState([]);
  const [warrantyRequests, setWarrantyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchRecentActivations();
    fetchWarrantyRequests();
  }, []);

  const fetchStats = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'devices'));
      const allDevices = snapshot.docs.map(d => d.data());
      const today = new Date().toISOString().split('T')[0];
      setStats(prev => ({
        ...prev,
        total: allDevices.length,
        active: allDevices.filter(d => d.isActive === true).length,
        warrantyActive: allDevices.filter(d => d.warrantyStatus === 'In Warranty').length,
        todayActivations: allDevices.filter(d => d.activationDate && d.activationDate.startsWith(today)).length,
      }));
    } catch (error) {
      toast.error('Failed to load stats');
    }
  };

  const fetchRecentActivations = async () => {
    try {
      const q = query(collection(db, 'devices'), orderBy('activationDate', 'desc'), limit(5));
      const snapshot = await getDocs(q);
      setRecentActivations(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
    }
  };

  const fetchWarrantyRequests = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'warrantyRequests'));
      const allRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setWarrantyRequests(allRequests);
      setStats(prev => ({
        ...prev,
        pendingWarranty: allRequests.filter(r => r.status === 'Pending').length,
        approvedWarranty: allRequests.filter(r => r.status === 'Approved').length,
        rejectedWarranty: allRequests.filter(r => r.status === 'Rejected').length,
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReceipt = async (request) => {
    try {
      // Find device by IMEI
      const q = query(collection(db, 'devices'), where('imei', '==', request.imei));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const device = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setSelectedDevice(device);
        setReceiptModalOpen(true);
      } else {
        toast.error('Device not found for this warranty request');
      }
    } catch (error) {
      toast.error('Failed to load device data');
    }
  };

  const statCards = [
    { label: 'Total Devices', value: stats.total, color: 'blue', icon: <FiBox /> },
    { label: 'Active Devices', value: stats.active, color: 'green', icon: <FiCheckCircle /> },
    { label: 'In Warranty', value: stats.warrantyActive, color: 'yellow', icon: <FiClock /> },
    { label: "Today's Activations", value: stats.todayActivations, color: 'purple', icon: <FiTrendingUp /> },
    { label: 'Pending Warranty', value: stats.pendingWarranty, color: 'orange', icon: <FiPackage /> },
    { label: 'Approved Warranty', value: stats.approvedWarranty, color: 'teal', icon: <FiCheckCircle /> },
    { label: 'Rejected Warranty', value: stats.rejectedWarranty, color: 'red', icon: <FiPackage /> },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Sales Dashboard</h2>
        <p className="text-gray-500 mt-1">Manage device activations and warranty</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className={`bg-gradient-to-br from-${card.color}-600 to-${card.color}-700 rounded-2xl p-5`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/80 text-sm">{card.label}</p>
                <p className="text-3xl font-bold text-white">{card.value}</p>
              </div>
              <div className="text-white/60 text-2xl">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card lg:col-span-2">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2"><FiTrendingUp /> Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link to="/sales/activate" className="bg-teal-600 p-4 rounded-xl text-white text-center hover:scale-105 transition">
              <div className="text-2xl">&#128241;</div><span>Activate Device</span>
            </Link>
            <Link to="/sales/bulk-upload" className="bg-indigo-600 p-4 rounded-xl text-white text-center hover:scale-105 transition">
              <div className="text-2xl">&#128194;</div><span>Bulk Upload</span>
            </Link>
            <Link to="/sales/search" className="bg-purple-600 p-4 rounded-xl text-white text-center hover:scale-105 transition">
              <div className="text-2xl">&#128269;</div><span>Advanced Search</span>
            </Link>
            <Link to="/warranty/request" className="bg-orange-600 p-4 rounded-xl text-white text-center hover:scale-105 transition">
              <div className="text-2xl">&#128295;</div><span>Warranty Request</span>
            </Link>
          </div>
        </div>

        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Recent Activations</h3>
          {loading ? <div className="loading-spinner mx-auto"></div> : recentActivations.length === 0 ? <p className="text-gray-500">No activations yet</p> : (
            <div className="space-y-2">
              {recentActivations.map(device => (
                <div key={device.id} className="p-3 bg-gray-100 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-mono text-sm">{device.imei}</p>
                    <p className="text-xs text-gray-500">{device.customerName}</p>
                  </div>
                  <span className={`badge ${device.warrantyStatus === 'In Warranty' ? 'badge-green' : 'badge-red'}`}>{device.warrantyStatus}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Warranty Requests Table */}
      <div className="card mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold flex items-center gap-2"><FiFileText /> Warranty Requests</h3>
        </div>
        {loading ? <div className="loading-spinner mx-auto"></div> : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>IMEI</th>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Status</th>
                  <th>Request Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {warrantyRequests.length === 0 && (
                  <tr><td colSpan="6" className="text-center text-gray-500 py-8">No warranty requests found</td></tr>
                )}
                {warrantyRequests.map(req => (
                  <tr key={req.id}>
                    <td className="font-mono text-sm">{req.imei}</td>
                    <td>{req.customerName}</td>
                    <td>{req.mobileNumber || 'N/A'}</td>
                    <td>
                      <span className={`badge ${
                        req.status === 'Approved' ? 'badge-green' :
                        req.status === 'Rejected' ? 'badge-red' :
                        'badge-yellow'
                      }`}>{req.status}</span>
                    </td>
                    <td>{req.requestDate ? new Date(req.requestDate).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      {req.status === 'Approved' && (
                        <button
                          onClick={() => handleGenerateReceipt(req)}
                          className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-sm"
                          title="Generate Warranty Receipt"
                        >
                          <FiFileText /> Receipt
                        </button>
                      )}
                      {req.status === 'Pending' && (
                        <span className="text-xs text-gray-400">Awaiting approval</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Warranty Receipt Modal */}
      <WarrantyReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        deviceData={selectedDevice}
      />
    </div>
  );
}

