import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { FiEdit2, FiTrash2, FiCheckCircle, FiXCircle, FiUsers, FiTool, FiAlertCircle, FiDownload, FiUpload, FiFileText, FiMail, FiMessageCircle } from 'react-icons/fi';
import WarrantyReceiptModal from '../components/WarrantyReceiptModal';
import { handleCaseStatusChange } from '../utils/caseStatusHandler';
import { createUserOnBackend, listUsersOnBackend, changePasswordOnBackend } from '../utils/backendAuth';

export default function AdminDashboard() {
  const [cases, setCases] = useState([]);
  const [partRequests, setPartRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [serviceCenters, setServiceCenters] = useState([]);
  const [activeTab, setActiveTab] = useState('cases');
  const [editingCase, setEditingCase] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [warrantyRequests, setWarrantyRequests] = useState([]);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedStat, setSelectedStat] = useState('Total Cases');
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadType, setBulkUploadType] = useState('openCases');
  const [bulkUploadFile, setBulkUploadFile] = useState(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'callcenter', mobileNumber: '', password: '' });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [bulkUploadLoading, setBulkUploadLoading] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const casesSnap = await getDocs(collection(db, 'cases'));
      const partsSnap = await getDocs(collection(db, 'partRequests'));
      const usersSnap = await getDocs(collection(db, 'users'));
      const centersSnap = await getDocs(collection(db, 'serviceCenters'));
      const warrantySnap = await getDocs(collection(db, 'warrantyRequests'));
      setCases(casesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPartRequests(partsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setServiceCenters(centersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setWarrantyRequests(warrantySnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCase = async (caseId, updatedData) => {
    try {
      const caseRef = doc(db, 'cases', caseId);
      const caseSnap = await getDocs(query(collection(db, 'cases'), where('__name__', '==', caseId)));
      
      const currentCase = cases.find(c => c.id === caseId);
      const oldStatus = currentCase?.jobStatus;
      const newStatus = updatedData.jobStatus;

      await updateDoc(caseRef, updatedData);
      
      // Send notification if status changed
      if (newStatus && newStatus !== oldStatus && currentCase) {
        const caseDataForNotif = { ...currentCase, ...updatedData };
        await handleCaseStatusChange(caseDataForNotif, newStatus, oldStatus);
      }

      toast.success('Case updated');
      fetchAllData();
      setEditingCase(null);
    } catch (error) {
      toast.error('Update failed: ' + error.message);
    }
  };

  const handleDeleteCase = async (caseId) => {
    if (window.confirm('Delete this case permanently?')) {
      try {
        await deleteDoc(doc(db, 'cases', caseId));
        toast.success('Case deleted');
        fetchAllData();
      } catch (error) {
        toast.error('Delete failed');
      }
    }
  };

  const handleApprovePart = async (partId, caseId) => {
    try {
      const currentCase = cases.find(c => c.id === caseId);
      await updateDoc(doc(db, 'partRequests', partId), { status: 'Approved', approvedAt: new Date().toISOString() });
      await updateDoc(doc(db, 'cases', caseId), { jobStatus: 'Part Approved' });
      
      // Send approval notification
      if (currentCase) {
        await handleCaseStatusChange(currentCase, 'Part Approved', currentCase.jobStatus);
      }
      
      toast.success('Part request approved & customer notified');
      fetchAllData();
    } catch (error) {
      toast.error('Approval failed: ' + error.message);
    }
  };

  const handleRejectPart = async (partId, caseId) => {
    if (window.confirm('Reject this part request?')) {
      try {
        await updateDoc(doc(db, 'partRequests', partId), { status: 'Rejected', rejectedAt: new Date().toISOString() });
        await updateDoc(doc(db, 'cases', caseId), { jobStatus: 'Open' });
        toast.success('Part request rejected');
        fetchAllData();
      } catch (error) {
        toast.error('Rejection failed');
      }
    }
  };

  const handleDeletePartRequest = async (partId) => {
    if (window.confirm('Delete this part request?')) {
      await deleteDoc(doc(db, 'partRequests', partId));
      toast.success('Deleted');
      fetchAllData();
    }
  };

  const handleApproveWarranty = async (reqId, imei, extendedYears) => {
    try {
      const devicesSnap = await getDocs(query(collection(db, 'devices'), where('imei', '==', imei)));
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
    await updateDoc(doc(db, 'warrantyRequests', reqId), { status: 'Rejected', rejectedAt: new Date().toISOString() });
    toast.success('Warranty request rejected');
    fetchAllData();
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

  const handleBulkUpload = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      let success = 0;
      for (const row of rows) {
        await addDoc(collection(db, 'devices'), {
          imei: row.imei,
          customerName: row.customerName,
          mobileNumber: row.mobileNumber,
          purchaseDate: row.purchaseDate,
          purchasePlatform: row.purchasePlatform || 'Online',
          dealerName: row.dealerName || '',
          isActive: true,
          activationDate: new Date().toISOString(),
          warrantyStatus: 'In Warranty',
          warrantyExpiry: new Date(new Date(row.purchaseDate).setFullYear(new Date(row.purchaseDate).getFullYear() + 1)).toISOString(),
        });
        success++;
      }
      toast.success(`${success} devices activated`);
      fetchAllData();
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = (type) => {
    let exportData = [];
    let filename = '';
    if (type === 'cases') {
      exportData = cases.map(c => ({ 'Job ID': c.jobId, 'Customer': c.customerName, 'Mobile': c.mobileNumber, 'Status': c.jobStatus }));
      filename = 'cases_report';
    } else if (type === 'open') {
      exportData = cases.filter(c => c.jobStatus === 'Open').map(c => ({ 'Job ID': c.jobId, 'Customer': c.customerName, 'Mobile': c.mobileNumber }));
      filename = 'open_cases';
    } else if (type === 'pending') {
      exportData = cases.filter(c => c.jobStatus === 'Pending Approval').map(c => ({ 'Job ID': c.jobId, 'Customer': c.customerName }));
      filename = 'pending_approval';
    } else if (type === 'closed') {
      exportData = cases.filter(c => c.jobStatus === 'Closed').map(c => ({ 'Job ID': c.jobId, 'Customer': c.customerName, 'Closed Date': c.closedDate }));
      filename = 'closed_cases';
    } else if (type === 'partRequests') {
      exportData = partRequests.map(p => ({ 'Job ID': p.jobId, 'Part': p.partName, 'Quantity': p.quantity, 'Status': p.status }));
      filename = 'part_requests';
    } else if (type === 'warranty') {
      exportData = warrantyRequests.map(w => ({ 'IMEI': w.imei, 'Customer': w.customerName, 'Status': w.status, 'Request Date': w.requestDate ? new Date(w.requestDate).toLocaleDateString() : 'N/A' }));
      filename = 'warranty_requests';
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${filename}.xlsx`);
    toast.success('Exported');
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('Name, email, and password are required');
      return;
    }
    if (newUser.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setCreateUserLoading(true);
    try {
      const result = await createUserOnBackend(newUser.email, newUser.password, newUser.role, newUser.name);
      if (result.success) {
        toast.success('User created successfully in backend. User can now log in.');
        setNewUser({ name: '', email: '', role: 'callcenter', mobileNumber: '', password: '' });
        fetchAllData();
      } else {
        toast.error(result.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Create user error:', error);
      toast.error('Failed to create user. Check server is running.');
    } finally {
      setCreateUserLoading(false);
    }
  };

  const handleBulkUploadFile = async (file) => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    setBulkUploadLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        let success = 0;
        for (const row of rows) {
          if (bulkUploadType === 'openCases' || bulkUploadType === 'closedCases' || bulkUploadType === 'bulkCancel') {
            const status = bulkUploadType === 'openCases' ? 'Open' : bulkUploadType === 'closedCases' ? 'Closed' : 'Cancelled';
            const casesSnap = await getDocs(query(collection(db, 'cases'), where('jobId', '==', row.jobId)));
            casesSnap.forEach(async (docSnap) => {
              await updateDoc(doc(db, 'cases', docSnap.id), { jobStatus: status, cancelNote: bulkUploadType === 'bulkCancel' ? 'Cancelled by bulk upload' : undefined });
            });
            success += casesSnap.size;
          }
          if (bulkUploadType === 'warrantyActivate' || bulkUploadType === 'bulkApprovedWarranty') {
            const warrantySnap = await getDocs(query(collection(db, 'warrantyRequests'), where('imei', '==', row.imei)));
            warrantySnap.forEach(async (docSnap) => {
              await updateDoc(doc(db, 'warrantyRequests', docSnap.id), { status: 'Approved', approvedAt: new Date().toISOString() });
            });
            success += warrantySnap.size;
          }
          if (bulkUploadType === 'bulkApprovedPartRequest') {
            const partSnap = await getDocs(query(collection(db, 'partRequests'), where('jobId', '==', row.jobId)));
            partSnap.forEach(async (docSnap) => {
              await updateDoc(doc(db, 'partRequests', docSnap.id), { status: 'Approved', approvedAt: new Date().toISOString() });
            });
            success += partSnap.size;
          }
          if (bulkUploadType === 'mobileActivate') {
            const casesSnap = await getDocs(query(collection(db, 'cases'), where('jobId', '==', row.jobId)));
            casesSnap.forEach(async (docSnap) => {
              await updateDoc(doc(db, 'cases', docSnap.id), { jobStatus: 'Mobile Activated', activationDate: new Date().toISOString() });
            });
            success += casesSnap.size;
          }
          if (bulkUploadType === 'uploadServiceCenters') {
            await addDoc(collection(db, 'serviceCenters'), {
              name: row.name || row.centerName,
              pinCode: row.pinCode,
              city: row.city,
              state: row.state,
              isActive: row.isActive !== 'false',
              createdAt: new Date().toISOString(),
            });
            success++;
          }
        }
        toast.success(`${success} rows processed`);
        setBulkUploadOpen(false);
        fetchAllData();
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      toast.error('Bulk upload failed');
    } finally {
      setBulkUploadLoading(false);
    }
  };

  const selectedDetails = () => {
    if (selectedStat === 'Total Cases' || selectedStat === 'Open Cases') {
      const rows = selectedStat === 'Open Cases' ? cases.filter(c => c.jobStatus === 'Open') : cases;
      return (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead><tr><th>Job ID</th><th>Customer</th><th>Mobile</th><th>Status</th><th>Center</th></tr></thead>
            <tbody>{rows.map(c => (
              <tr key={c.id}><td>{c.jobId}</td><td>{c.customerName}</td><td>{c.mobileNumber}</td><td>{c.jobStatus}</td><td>{c.serviceCenterId || 'N/A'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      );
    }
    if (selectedStat === 'Pending Approvals') {
      return (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm"><thead><tr><th>Job ID</th><th>Part</th><th>Qty</th><th>Status</th></tr></thead><tbody>{partRequests.filter(p => p.status === 'Pending Approval').map(p => (
            <tr key={p.id}><td>{p.jobId}</td><td>{p.partName}</td><td>{p.quantity}</td><td>{p.status}</td></tr>
          ))}</tbody></table>
        </div>
      );
    }
    if (selectedStat === 'Total Users') {
      return (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th></tr></thead><tbody>{users.map(u => (
            <tr key={u.id}><td>{u.name || 'Unknown'}</td><td>{u.email}</td><td>{u.role}</td><td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td></tr>
          ))}</tbody></table>
        </div>
      );
    }
    if (selectedStat === 'Pending Warranty' || selectedStat === 'Approved Warranty' || selectedStat === 'Rejected Warranty') {
      const rows = warrantyRequests.filter(w => w.status === selectedStat.split(' ')[0]);
      return (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm"><thead><tr><th>IMEI</th><th>Customer</th><th>Status</th><th>Request Date</th></tr></thead><tbody>{rows.map(w => (
            <tr key={w.id}><td>{w.imei}</td><td>{w.customerName}</td><td>{w.status}</td><td>{w.requestDate ? new Date(w.requestDate).toLocaleDateString() : 'N/A'}</td></tr>
          ))}</tbody></table>
        </div>
      );
    }
    if (selectedStat === 'Active Centers') {
      return (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm"><thead><tr><th>Center</th><th>City</th><th>Status</th></tr></thead><tbody>{serviceCenters.map(center => (
            <tr key={center.id}><td>{center.name}</td><td>{center.city}</td><td>{center.isActive || center.status === 'Active' ? 'Active' : 'Inactive'}</td></tr>
          ))}</tbody></table>
        </div>
      );
    }
    return null;
  };

  const today = new Date();
  const getDate = (value) => {
    if (!value) return null;
    return value instanceof Date ? value : new Date(value);
  };

  const loginCounts = {
    today: users.filter(u => {
      const loginAt = getDate(u.lastLoginAt);
      return loginAt && loginAt.toDateString() === today.toDateString();
    }).length,
    yesterday: users.filter(u => {
      const loginAt = getDate(u.lastLoginAt);
      if (!loginAt) return false;
      const comparisonDate = new Date(loginAt);
      comparisonDate.setDate(comparisonDate.getDate() + 1);
      return comparisonDate.toDateString() === today.toDateString();
    }).length,
    week: users.filter(u => {
      const loginAt = getDate(u.lastLoginAt);
      return loginAt && (today - loginAt) / (1000 * 60 * 60 * 24) <= 7;
    }).length,
    month: users.filter(u => {
      const loginAt = getDate(u.lastLoginAt);
      return loginAt && loginAt.getMonth() === today.getMonth() && loginAt.getFullYear() === today.getFullYear();
    }).length,
    lastMonth: users.filter(u => {
      const loginAt = getDate(u.lastLoginAt);
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1);
      return loginAt && loginAt.getMonth() === lastMonth.getMonth() && loginAt.getFullYear() === lastMonth.getFullYear();
    }).length,
  };

  const activeCenters = serviceCenters.filter(center => center.isActive || center.status === 'Active').length;

  const stats = [
    { label: 'Total Cases', value: cases.length, icon: <FiAlertCircle /> },
    { label: 'Open Cases', value: cases.filter(c => c.jobStatus === 'Open').length, icon: <FiAlertCircle /> },
    { label: 'Pending Approvals', value: partRequests.filter(p => p.status === 'Pending Approval').length, icon: <FiTool /> },
    { label: 'Total Users', value: users.length, icon: <FiUsers /> },
    { label: 'Pending Warranty', value: warrantyRequests.filter(w => w.status === 'Pending').length, icon: <FiFileText /> },
    { label: 'Approved Warranty', value: warrantyRequests.filter(w => w.status === 'Approved').length, icon: <FiCheckCircle /> },
    { label: 'Rejected Warranty', value: warrantyRequests.filter(w => w.status === 'Rejected').length, icon: <FiXCircle /> },
    { label: 'Active Centers', value: activeCenters, icon: <FiUsers /> },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Admin Dashboard</h2>
        <p className="text-gray-500 mt-1">Full control – edit, delete, approve, export</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, idx) => (
          <button key={idx} type="button" onClick={() => setSelectedStat(stat.label)} className={`text-left rounded-3xl border ${selectedStat === stat.label ? 'border-blue-300 bg-sky-100 shadow-lg' : 'border-slate-200 bg-slate-50'} p-5 transition hover:border-blue-300 hover:bg-sky-50`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-600 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
              </div>
              <div className="text-slate-700 text-2xl">{stat.icon}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold">Details: {selectedStat}</h3>
            <p className="text-sm text-slate-500">Click any card to view more detailed records.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-center">Today logins<br /><span className="font-semibold text-slate-900">{loginCounts.today}</span></div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-center">Yesterday<br /><span className="font-semibold text-slate-900">{loginCounts.yesterday}</span></div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-center">This week<br /><span className="font-semibold text-slate-900">{loginCounts.week}</span></div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-center">This month<br /><span className="font-semibold text-slate-900">{loginCounts.month}</span></div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-center">Last month<br /><span className="font-semibold text-slate-900">{loginCounts.lastMonth}</span></div>
          </div>
        </div>
        {selectedDetails()}
      </div>

      {/* Export Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => handleExport('cases')} className="btn-primary text-sm"><FiDownload /> All Cases</button>
        <button onClick={() => handleExport('open')} className="btn-secondary text-sm"><FiDownload /> Open</button>
        <button onClick={() => handleExport('pending')} className="btn-warning text-sm"><FiDownload /> Pending</button>
        <button onClick={() => handleExport('closed')} className="btn-secondary text-sm"><FiDownload /> Closed</button>
        <button onClick={() => handleExport('partRequests')} className="btn-primary text-sm"><FiDownload /> Part Requests</button>
        <button onClick={() => handleExport('warranty')} className="btn-primary text-sm"><FiDownload /> Warranty</button>
        <button onClick={() => setBulkUploadOpen(true)} className="btn-secondary text-sm"><FiUpload /> Bulk Upload</button>
      </div>

      {bulkUploadOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold">Admin Bulk Upload</h3>
                <p className="text-slate-500 text-sm">Select the upload type and import an Excel file.</p>
              </div>
<button onClick={() => setBulkUploadOpen(false)} className="text-slate-500 hover:text-slate-900"><FiXCircle size={24} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {[
                { key: 'openCases', label: 'Open Cases' },
                { key: 'closedCases', label: 'Closed Cases' },
                { key: 'warrantyActivate', label: 'Warranty Activate' },
                { key: 'mobileActivate', label: 'Mobile Activate' },
                { key: 'bulkApprovedWarranty', label: 'Bulk Approved Warranty' },
                { key: 'bulkApprovedPartRequest', label: 'Bulk Approved Part Request' },
                { key: 'uploadServiceCenters', label: 'Upload Service Centers' },
                { key: 'bulkCancel', label: 'Bulk Cancel Cases' },
              ].map(option => (
                <button key={option.key} type="button" onClick={() => setBulkUploadType(option.key)} className={`rounded-2xl border p-3 text-left ${bulkUploadType === option.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                  {option.label}
                </button>
              ))}
            </div>
            <div className="border border-slate-200 rounded-2xl p-4 mb-4">
              <input type="file" accept=".xlsx,.xls" onChange={e => setBulkUploadFile(e.target.files[0])} className="w-full" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setBulkUploadOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleBulkUploadFile(bulkUploadFile)} disabled={bulkUploadLoading} className="btn-primary">{bulkUploadLoading ? 'Processing...' : 'Upload and Process'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 mb-6">
        {['cases', 'partRequests', 'users', 'warrantyRequests', 'serviceCenters'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 font-semibold transition-all ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-600'}`}>
            {tab === 'cases' ? 'Cases' : tab === 'partRequests' ? 'Part Requests' : tab === 'users' ? 'Users' : tab === 'warrantyRequests' ? 'Warranty' : 'Centers'}
          </button>
        ))}
      </div>

      {/* Cases Tab */}
      {activeTab === 'cases' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm"><thead><tr><th>Job ID</th><th>Customer</th><th>Mobile</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {cases.map(c => (
              <tr key={c.id}><td>{c.jobId}</td><td>{c.customerName}</td><td>{c.mobileNumber}</td><td><span className={`badge ${c.jobStatus === 'Open' ? 'badge-green' : 'badge-yellow'}`}>{c.jobStatus}</span></td>
              <td><button onClick={() => setEditingCase(c)} className="text-blue-600 mr-2"><FiEdit2 /></button><button onClick={() => handleDeleteCase(c.id)} className="text-red-400"><FiTrash2 /></button></td></tr>
            ))}
          </tbody></table>
        </div>
      )}

      {/* Part Requests Tab */}
      {activeTab === 'partRequests' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm"><thead><tr><th>Job ID</th><th>Part</th><th>Qty</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {partRequests.map(p => (
              <tr key={p.id}><td>{p.jobId}</td><td>{p.partName}</td><td>{p.quantity}</td><td><span className={`badge ${p.status === 'Pending Approval' ? 'badge-yellow' : p.status === 'Approved' ? 'badge-green' : 'badge-red'}`}>{p.status}</span></td>
              <td>
                {p.status === 'Pending Approval' && <><button onClick={() => handleApprovePart(p.id, p.caseId)} className="text-green-600 mr-2"><FiCheckCircle /></button><button onClick={() => handleRejectPart(p.id, p.caseId)} className="text-red-400 mr-2"><FiXCircle /></button></>}
                <button onClick={() => handleDeletePartRequest(p.id)} className="text-red-400"><FiTrash2 /></button>
              </td></tr>
            ))}
          </tbody></table>
        </div>
      )}

      {/* Warranty Requests Tab */}
      {activeTab === 'warrantyRequests' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm"><thead><tr><th>IMEI</th><th>Customer</th><th>Mobile</th><th>Request Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {warrantyRequests.map(w => (
              <tr key={w.id}>
                <td className="font-mono">{w.imei}</td>
                <td>{w.customerName}</td>
                <td>{w.mobileNumber || 'N/A'}</td>
                <td>{w.requestDate ? new Date(w.requestDate).toLocaleDateString() : 'N/A'}</td>
                <td><span className={`badge ${w.status === 'Approved' ? 'badge-green' : w.status === 'Rejected' ? 'badge-red' : 'badge-yellow'}`}>{w.status}</span></td>
                <td>
                  {w.status === 'Pending' && (
                    <>
                      <button onClick={() => handleApproveWarranty(w.id, w.imei, w.extendedYears)} className="text-green-600 mr-2" title="Approve"><FiCheckCircle /></button>
                      <button onClick={() => handleRejectWarranty(w.id)} className="text-red-400" title="Reject"><FiXCircle /></button>
                    </>
                  )}
                  {w.status === 'Approved' && (
                    <>
                      <button onClick={() => handleGenerateReceipt(w)} className="text-indigo-600 mr-2" title="Generate Receipt"><FiFileText /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}

      {activeTab === 'users' && (
        <>
          <div className="grid gap-4 lg:grid-cols-2 mb-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Create user record</h3>
              <div className="grid gap-4">
                <input value={newUser.name} onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))} placeholder="Name" className="input-field" />
                <input value={newUser.email} onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))} placeholder="Email" className="input-field" />
                <input value={newUser.password} onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))} type="password" placeholder="Password" className="input-field" />
                <input value={newUser.mobileNumber} onChange={e => setNewUser(prev => ({ ...prev, mobileNumber: e.target.value }))} placeholder="Mobile number" className="input-field" />
                <select value={newUser.role} onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))} className="input-field">
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="tl">Team Lead</option>
                  <option value="callcenter">Call Center</option>
                  <option value="service">Service</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="sales">Sales</option>
                </select>
                <button onClick={handleCreateUser} disabled={createUserLoading} className="btn-primary">{createUserLoading ? 'Saving...' : 'Create User Record'}</button>
              </div>
              <p className="text-xs text-slate-500 mt-3">User account is created in the backend (local JSON storage). No Firebase required. Server must be running on port 5000.</p>
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th></tr></thead><tbody>{users.map(u => (
              <tr key={u.id}><td>{u.name || 'Unknown'}</td><td>{u.email}</td><td>{u.role}</td><td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td><td>{u.disabled ? 'Locked' : 'Active'}</td></tr>
            ))}</tbody></table>
          </div>
        </>
      )}

      {activeTab === 'serviceCenters' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm"><thead><tr><th>Name</th><th>City</th><th>Pincode</th><th>Status</th></tr></thead><tbody>{serviceCenters.map(center => (
            <tr key={center.id}><td>{center.name}</td><td>{center.city}</td><td>{center.pinCode || center.zip}</td><td>{center.isActive || center.status === 'Active' ? 'Active' : 'Inactive'}</td></tr>
          ))}</tbody></table>
        </div>
      )}

      {editingCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-100 rounded-2xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold mb-4">Edit Case</h3>
            <div className="grid grid-cols-2 gap-4">
              <input defaultValue={editingCase.customerName} id="editName" className="input-field" />
              <input defaultValue={editingCase.mobileNumber} id="editMobile" className="input-field" />
              <select defaultValue={editingCase.jobStatus} id="editStatus" className="input-field"><option>Open</option><option>In Progress</option><option>Closed</option></select>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={() => handleUpdateCase(editingCase.id, { customerName: document.getElementById('editName').value, mobileNumber: document.getElementById('editMobile').value, jobStatus: document.getElementById('editStatus').value })} className="btn-primary">Save</button><button onClick={() => setEditingCase(null)} className="btn-secondary">Cancel</button></div>
          </div>
        </div>
      )}

      <WarrantyReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        deviceData={selectedDevice}
      />
    </div>
  );
}

