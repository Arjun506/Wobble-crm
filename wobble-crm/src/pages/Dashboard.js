import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, updateDoc, doc, getDocs as getDocsQuery } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  FiPackage, FiCheckCircle, FiClock, FiAlertCircle, FiTrendingUp, FiUsers, FiTool,
  FiEye, FiDownload, FiCheckCircle as FiApprove, FiXCircle, FiShield, FiBox, FiFileText
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { BrandIcon } from '../components/BrandLogo';
import WarrantyReceiptModal from '../components/WarrantyReceiptModal';

export default function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [allCases, setAllCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [serviceCenterId, setServiceCenterId] = useState(null);
  const [warrantyRequests, setWarrantyRequests] = useState([]);
  const [devices, setDevices] = useState([]);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const fetchUserServiceCenter = useCallback(() => {
    if (role === 'callcenter') setServiceCenterId(null);
    else if (role === 'service') setServiceCenterId('SC-WBL-001');
    else if (role === 'admin') setServiceCenterId(null);
    else if (role === 'sales') setServiceCenterId(null);
    else setServiceCenterId(null);
  }, [role]);

  const fetchAllData = useCallback(async () => {
    try {
      let casesRef = collection(db, 'cases');
      let snapshot;
      if (serviceCenterId && role !== 'admin' && role !== 'callcenter' && role !== 'sales') {
        const q = query(casesRef, where('serviceCenterId', '==', serviceCenterId));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(casesRef);
      }
      const allCasesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllCases(allCasesData);

      if (role === 'admin' || role === 'sales' || role === 'callcenter') {
        const warrantySnap = await getDocs(collection(db, 'warrantyRequests'));
        setWarrantyRequests(warrantySnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }

      if (role === 'sales') {
        const devicesSnap = await getDocs(collection(db, 'devices'));
        setDevices(devicesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (error) {
      toast.error('Failed to load dashboard data');
    }
  }, [serviceCenterId, role]);

  useEffect(() => {
    fetchUserServiceCenter();
  }, [fetchUserServiceCenter]);

  useEffect(() => {
    if (serviceCenterId !== undefined) {
      fetchAllData();
    }
  }, [serviceCenterId, fetchAllData]);

  const stats = {
    total: allCases.length,
    open: allCases.filter(c => c.jobStatus === 'Open').length,
    inProgress: allCases.filter(c => c.jobStatus === 'In Progress').length,
    pendingApproval: allCases.filter(c => c.jobStatus === 'Pending Approval').length,
    partDispatchPending: allCases.filter(c => c.jobStatus === 'Part Dispatch Pending').length,
    partDispatched: allCases.filter(c => c.jobStatus === 'Part Dispatched').length,
    partReceived: allCases.filter(c => c.jobStatus === 'Part Received').length,
    repairDone: allCases.filter(c => c.jobStatus === 'Repair Done').length,
    closed: allCases.filter(c => c.jobStatus === 'Closed').length,
    warrantyPending: (role === 'admin' || role === 'sales' || role === 'callcenter') ? warrantyRequests.filter(w => w.status === 'Pending').length : 0,
    warrantyApproved: (role === 'admin' || role === 'sales' || role === 'callcenter') ? warrantyRequests.filter(w => w.status === 'Approved').length : 0,
    totalDevices: role === 'sales' ? devices.length : 0,
    activeDevices: role === 'sales' ? devices.filter(d => d.isActive === true).length : 0,
    inWarrantyDevices: role === 'sales' ? devices.filter(d => d.warrantyStatus === 'In Warranty').length : 0,
  };

  const statGradientMap = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    yellow: 'from-amber-500 to-amber-600',
    orange: 'from-orange-500 to-orange-600',
    purple: 'from-violet-500 to-violet-600',
    gray: 'from-slate-500 to-slate-600',
    indigo: 'from-indigo-500 to-indigo-600',
    teal: 'from-teal-500 to-teal-600',
  };

  const handleCardClick = (filterType) => {
    if (filterType === 'warranty') {
      setSelectedFilter('warranty');
      setFilteredCases([]);
      return;
    }
    setSelectedFilter(filterType);
    let filtered = [];
    if (filterType === 'total') filtered = allCases;
    else if (filterType === 'open') filtered = allCases.filter(c => c.jobStatus === 'Open');
    else if (filterType === 'inProgress') filtered = allCases.filter(c => c.jobStatus === 'In Progress');
    else if (filterType === 'pendingApproval') filtered = allCases.filter(c => c.jobStatus === 'Pending Approval');
    else if (filterType === 'partDispatchPending') filtered = allCases.filter(c => c.jobStatus === 'Part Dispatch Pending');
    else if (filterType === 'partDispatched') filtered = allCases.filter(c => c.jobStatus === 'Part Dispatched');
    else if (filterType === 'partReceived') filtered = allCases.filter(c => c.jobStatus === 'Part Received');
    else if (filterType === 'repairDone') filtered = allCases.filter(c => c.jobStatus === 'Repair Done');
    else if (filterType === 'closed') filtered = allCases.filter(c => c.jobStatus === 'Closed');
    setFilteredCases(filtered);
  };

  const handleDownloadExcel = () => {
    let exportData = [];
    let filename = '';
    if (selectedFilter === 'warranty') {
      exportData = warrantyRequests.filter(w => w.status === 'Pending').map(w => ({
        'IMEI': w.imei,
        'Customer': w.customerName,
        'Mobile': w.mobileNumber || 'N/A',
        'Request Date': new Date(w.requestDate).toLocaleDateString(),
        'Status': w.status,
        'Extended Years': w.extendedYears,
        'Reason': w.reason || 'N/A',
      }));
      filename = 'warranty_approval_pending';
    } else {
      exportData = filteredCases.map(c => ({
        'Job ID': c.jobId,
        'Customer': c.customerName,
        'Mobile': c.mobileNumber,
        'Device': c.deviceModel || 'N/A',
        'IMEI': c.imei1 || 'N/A',
        'Status': c.jobStatus,
        'Issue': c.issueType || 'N/A',
        'Register Date': c.caseRegisterDate ? new Date(c.caseRegisterDate).toLocaleDateString() : 'N/A',
      }));
      filename = selectedFilter === 'total' ? 'all_cases' : `${selectedFilter}_cases`;
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${filename}.xlsx`);
    toast.success('Report downloaded');
  };

  const handleApproveWarranty = async (reqId, imei, extendedYears) => {
    try {
      const devicesSnap = await getDocsQuery(query(collection(db, 'devices'), where('imei', '==', imei)));
      if (!devicesSnap.empty) {
        const deviceDoc = devicesSnap.docs[0];
        const currentExpiry = deviceDoc.data().warrantyExpiry ? new Date(deviceDoc.data().warrantyExpiry) : new Date();
        const newExpiry = new Date(currentExpiry);
        newExpiry.setFullYear(newExpiry.getFullYear() + (extendedYears || 1));
        await updateDoc(doc(db, 'devices', deviceDoc.id), {
          extendedWarranty: true,
          warrantyExpiry: newExpiry.toISOString(),
          warrantyStatus: 'In Warranty',
        });
      }
      await updateDoc(doc(db, 'warrantyRequests', reqId), { status: 'Approved', approvedAt: new Date().toISOString() });
      toast.success('Warranty approved');
      fetchAllData();
    } catch (error) {
      toast.error('Approval failed');
    }
  };

  const handleRejectWarranty = async (reqId) => {
    try {
      await updateDoc(doc(db, 'warrantyRequests', reqId), { status: 'Rejected', rejectedAt: new Date().toISOString() });
      toast.success('Warranty request rejected');
      fetchAllData();
    } catch (error) {
      toast.error('Rejection failed');
    }
  };

  const handleGenerateReceipt = async (warrantyReq) => {
    try {
      const q = query(collection(db, 'devices'), where('imei', '==', warrantyReq.imei));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const device = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setSelectedDevice(device);
        setReceiptModalOpen(true);
      } else {
        toast.error('Device not found');
      }
    } catch (error) {
      toast.error('Failed to load device');
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

  const getStatCards = () => {
    if (role === 'sales') {
      return [
        { label: 'Total Devices', value: stats.totalDevices, color: 'blue', icon: <FiBox />, key: 'totalDevices' },
        { label: 'Active Devices', value: stats.activeDevices, color: 'green', icon: <FiCheckCircle />, key: 'activeDevices' },
        { label: 'In Warranty', value: stats.inWarrantyDevices, color: 'yellow', icon: <FiClock />, key: 'inWarrantyDevices' },
        { label: 'Pending Warranty', value: stats.warrantyPending, color: 'orange', icon: <FiShield />, key: 'warrantyPending' },
        { label: 'Approved Warranty', value: stats.warrantyApproved, color: 'teal', icon: <FiCheckCircle />, key: 'warrantyApproved' },
      ];
    }

    const baseCards = [
      { label: 'Total Cases', value: stats.total, color: 'blue', icon: <FiPackage />, key: 'total' },
      { label: 'Open', value: stats.open, color: 'green', icon: <FiAlertCircle />, key: 'open' },
      { label: 'In Progress', value: stats.inProgress, color: 'yellow', icon: <FiClock />, key: 'inProgress' },
      { label: 'Pending Approval', value: stats.pendingApproval, color: 'orange', icon: <FiTool />, key: 'pendingApproval' },
      { label: 'Part Dispatched', value: stats.partDispatched, color: 'purple', icon: <FiPackage />, key: 'partDispatched' },
      { label: 'Closed', value: stats.closed, color: 'gray', icon: <FiCheckCircle />, key: 'closed' },
    ];

    if (role === 'admin' || role === 'callcenter') {
      baseCards.push({ label: 'Warranty Pending', value: stats.warrantyPending, color: 'indigo', icon: <FiShield />, key: 'warranty' });
    }

    return baseCards;
  };

  const statCards = getStatCards();

  const quickActions = {
    callcenter: [{ name: 'Register Case', path: '/cases/register', icon: '📝', color: 'bg-blue-600' }, { name: 'Search Cases', path: '/cases/search', icon: '🔍', color: 'bg-indigo-600' }, { name: 'Warranty Request', path: '/warranty/request', icon: '🛡️', color: 'bg-orange-600' }],
    service: [{ name: 'Register Case', path: '/cases/register', icon: '📝', color: 'bg-blue-600' }, { name: 'Raise Part Request', path: '/part-requests/new', icon: '🔧', color: 'bg-orange-600' }, { name: 'Search Cases', path: '/cases/search', icon: '🔍', color: 'bg-indigo-600' }],
    warehouse: [{ name: 'Dispatch Parts', path: '/warehouse/dispatch', icon: '📦', color: 'bg-green-600' }],
    admin: [{ name: 'Register Case', path: '/cases/register', icon: '📝', color: 'bg-blue-600' }, { name: 'Approve Requests', path: '/admin/approvals', icon: '✅', color: 'bg-purple-600' }, { name: 'Reports', path: '/reports', icon: '📊', color: 'bg-green-600' }, { name: 'Admin Panel', path: '/admin/dashboard', icon: '👑', color: 'bg-red-600' }, { name: 'Sales Team', path: '/sales/dashboard', icon: '📱', color: 'bg-teal-600' }],
    sales: [{ name: 'Activate Device', path: '/sales/activate', icon: '📱', color: 'bg-teal-600' }, { name: 'Bulk Upload', path: '/sales/bulk-upload', icon: '📂', color: 'bg-indigo-600' }, { name: 'Advanced Search', path: '/sales/search', icon: '🔍', color: 'bg-purple-600' }, { name: 'Warranty Request', path: '/warranty/request', icon: '🛡️', color: 'bg-orange-600' }],
  };

  const isActive = (key) => selectedFilter === key;

  return (
    <div>
      <div className="relative card mb-8 overflow-hidden p-8 bg-gradient-to-br from-white to-slate-100 border border-slate-200 shadow-xl">
        <div className="pointer-events-none absolute right-6 top-6 text-[clamp(3.5rem,6vw,7.5rem)] font-black tracking-[0.5em] text-slate-900/5 uppercase">
          Wobble CRM
        </div>
        <div className="relative pt-2">
          <h2 className="text-3xl font-bold text-slate-900">Welcome back, {user?.name || user?.email?.split('@')[0]}!</h2>
          <p className="text-slate-600 mt-1">{serviceCenterId ? `Service Center: ${serviceCenterId}` : 'All Centers'}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 mb-8 ${role === 'sales' ? 'lg:grid-cols-5' : role === 'admin' ? 'lg:grid-cols-7' : 'lg:grid-cols-6'}`}>
        {statCards.map(card => (
          <button
            key={card.key}
            onClick={() => handleCardClick(card.key)}
            className={`relative rounded-2xl p-4 text-left transition-all duration-200 hover:scale-105 hover:shadow-xl ${
              isActive(card.key)
                ? 'ring-2 ring-white/50 shadow-2xl bg-gradient-to-br from-blue-500 to-purple-600'
                : `bg-gradient-to-br ${statGradientMap[card.color] || 'from-slate-500 to-slate-600'}`
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white text-xs">{card.label}</p>
                <p className="text-2xl font-bold text-white">{card.value}</p>
              </div>
              <div className="text-white text-xl">{card.icon}</div>
            </div>
            {isActive(card.key) && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/40 rounded-b-2xl" />
            )}
          </button>
        ))}
      </div>

      {/* Cases / Warranty Details Table */}
      {selectedFilter && (
        <div className="card mb-8 animate-fadeIn">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <h3 className="text-xl font-semibold">
              {selectedFilter === 'warranty'
                ? 'Warranty Approval Requests'
                : `${statCards.find(s => s.key === selectedFilter)?.label} — ${filteredCases.length} case(s)`}
            </h3>
            <div className="flex gap-3">
              <button onClick={handleDownloadExcel} className="btn-primary text-sm flex items-center gap-2">
                <FiDownload /> Download Excel
              </button>
              <button onClick={() => setSelectedFilter(null)} className="btn-secondary text-sm">
                Close
              </button>
            </div>
          </div>

          {selectedFilter === 'warranty' ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>IMEI</th>
                    <th>Customer</th>
                    <th>Mobile</th>
                    <th>Request Date</th>
                    <th>Extended Years</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {warrantyRequests.filter(w => w.status === 'Pending').length === 0 && (
                    <tr>
                      <td colSpan="8" className="text-center text-gray-500 py-8">No pending warranty requests</td>
                    </tr>
                  )}
                  {warrantyRequests.filter(w => w.status === 'Pending').map(w => (
                    <tr key={w.id}>
                      <td className="font-mono text-sm">{w.imei}</td>
                      <td>{w.customerName}</td>
                      <td>{w.mobileNumber || 'N/A'}</td>
                      <td>{new Date(w.requestDate).toLocaleDateString()}</td>
                      <td>{w.extendedYears || 1} year(s)</td>
                      <td>{w.reason || 'N/A'}</td>
                      <td><span className="badge badge-yellow">{w.status}</span></td>
                      <td>
                        <button onClick={() => handleApproveWarranty(w.id, w.imei, w.extendedYears)} className="text-green-600 mr-3" title="Approve"><FiApprove /></button>
                        <button onClick={() => handleRejectWarranty(w.id)} className="text-red-400" title="Reject"><FiXCircle /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Customer</th>
                    <th>Mobile</th>
                    <th>Status</th>
                    <th>Device</th>
                    <th>Register Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center text-gray-500 py-8">No cases found</td>
                    </tr>
                  )}
                  {filteredCases.map(c => (
                    <tr key={c.id}>
                      <td className="font-mono text-sm">{c.jobId}</td>
                      <td>{c.customerName}</td>
                      <td>{c.mobileNumber}</td>
                      <td><span className={`badge ${getStatusBadge(c.jobStatus)}`}>{c.jobStatus}</span></td>
                      <td>{c.deviceModel || 'N/A'}</td>
                      <td>{c.caseRegisterDate ? new Date(c.caseRegisterDate).toLocaleDateString() : 'N/A'}</td>
                      <td>
                        <button onClick={() => navigate(role === 'service' || role === 'admin' ? `/service/case/${c.id}` : `/case/${c.id}`)} className="text-blue-600 flex items-center gap-1">
                          <FiEye /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions & Role Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card lg:col-span-2">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2"><FiTrendingUp /> Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions[role]?.map(a => (
              <Link key={a.name} to={a.path} className={`${a.color} p-4 rounded-xl text-white text-center hover:scale-105 transition`}>
                <div className="text-2xl">{a.icon}</div>
                <span className="text-sm">{a.name}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 className="text-xl font-semibold mb-4"><FiUsers /> Role Info</h3>
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-gray-100 rounded-xl">
              <span className="text-gray-500">Your Role</span>
              <span className="capitalize text-blue-600">{role}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-100 rounded-xl">
              <span className="text-gray-500">Email</span>
              <span className="text-sm">{user?.email}</span>
            </div>
            {serviceCenterId && (
              <div className="flex justify-between p-3 bg-gray-100 rounded-xl">
                <span className="text-gray-500">Center ID</span>
                <span className="font-mono text-sm">{serviceCenterId}</span>
              </div>
            )}
          </div>
        </div>
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
