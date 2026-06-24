import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import { FiTool, FiPlus, FiCheckCircle, FiCamera, FiFileText, FiPackage, FiUserCheck } from 'react-icons/fi';
import { sendRepairVisitNotification, sendRepairDoneNotification } from '../utils/messaging';
import { useAuth } from '../contexts/AuthContext';

export default function ServiceCaseDetail() {

  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [subStatus, setSubStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [partRequests, setPartRequests] = useState([]);
  const [showPartForm, setShowPartForm] = useState(false);
  const [partForm, setPartForm] = useState({ partName: '', quantity: 1, variant: '', issueDescription: '' });
  const [showPartReceived, setShowPartReceived] = useState(null);
  const [damagedFile, setDamagedFile] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [invoiceFiles, setInvoiceFiles] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);

  const { user } = useAuth();


  const fetchData = useCallback(async () => {
    try {
      const docRef = doc(db, 'cases', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setCaseData(data);
        setDiagnosis(data.diagnosis || '');
        setNewStatus(data.jobStatus || 'Open');
        setSubStatus(data.subStatus || '');
        setUploadedFiles(data.photos || []);
        setInvoiceFiles(data.invoices || []);
        setStatusHistory(data.statusHistory || []);

        const partSnap = await getDocs(query(collection(db, 'partRequests'), where('caseId', '==', id)));
        setPartRequests(partSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        navigate('/cases/search');
      }
    } catch (error) {
      toast.error('Error fetching case');
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addStatusHistory = (status, note = '') => {
    const entry = {
      status,
      note,
      timestamp: new Date().toISOString(),
      updatedBy: user?.email || 'Unknown',
    };
    return [...(statusHistory || []), entry];
  };

  const handleUpdate = async () => {
    setLoading(true);
    const previousStatus = caseData?.jobStatus;
    try {
      const newHistory = addStatusHistory(newStatus, diagnosis);
      await updateDoc(doc(db, 'cases', id), {
        diagnosis,
        jobStatus: newStatus,
        subStatus,
        statusHistory: newHistory,
        updatedAt: new Date().toISOString(),
      });
      toast.success('Case updated');

      if (newStatus === 'In Progress' && previousStatus !== 'In Progress' && caseData) {
        try {
          const notifResults = await sendRepairVisitNotification(caseData);
          if (notifResults.whatsapp?.mock || notifResults.sms?.mock || notifResults.email?.mock) {
            toast('Repair visit notification sent (mock mode)', { icon: '⚠️', duration: 4000 });
          } else {
            toast.success('Repair visit notification sent to customer');
          }
        } catch (notifErr) {
          toast.error('Status saved but repair notification failed');
        }
      }

      if (newStatus === 'Repair Done' && previousStatus !== 'Repair Done' && caseData) {
        try {
          const notifResults = await sendRepairDoneNotification(caseData);
          if (notifResults.whatsapp?.mock || notifResults.sms?.mock || notifResults.email?.mock) {
            toast('Repair done notification sent (mock mode)', { icon: '⚠️', duration: 4000 });
          } else {
            toast.success('Repair done notification sent to customer');
          }
        } catch (notifErr) {
          toast.error('Status saved but repair done notification failed');
        }
      }

      fetchData();
    } catch (error) {
      toast.error('Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const storageRef = ref(storage, `cases/${id}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
      });
      const urls = await Promise.all(uploadPromises);
      const newPhotos = [...uploadedFiles, ...urls];
      await updateDoc(doc(db, 'cases', id), { photos: newPhotos });
      setUploadedFiles(newPhotos);
      toast.success(`${files.length} file(s) uploaded`);
      fetchData();
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleInvoiceUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const storageRef = ref(storage, `invoices/${id}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
      });
      const urls = await Promise.all(uploadPromises);
      const newInvoices = [...invoiceFiles, ...urls];
      await updateDoc(doc(db, 'cases', id), { invoices: newInvoices });
      setInvoiceFiles(newInvoices);
      toast.success(`${files.length} invoice(s) uploaded`);
      fetchData();
    } catch (error) {
      toast.error('Invoice upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRaisePartRequest = async () => {
    if (!partForm.partName) {
      toast.error('Part name required');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'partRequests'), {
        caseId: id,
        jobId: caseData.jobId,
        imei: caseData.imei1,
        customerName: caseData.customerName,
        ...partForm,
        quantity: parseInt(partForm.quantity),
        requestDate: new Date().toISOString(),
        status: 'Pending Approval',
      });
      await updateDoc(doc(db, 'cases', id), {
        jobStatus: 'Pending Approval',
        subStatus: 'Part Request Raised',
        statusHistory: addStatusHistory('Pending Approval', `Part request raised: ${partForm.partName}`),
      });
      toast.success('Part request raised');
      setShowPartForm(false);
      setPartForm({ partName: '', quantity: 1, variant: '', issueDescription: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to raise request');
    } finally {
      setLoading(false);
    }
  };

  const handlePartReceived = async (requestId, partName) => {
    if (!damagedFile) {
      toast.error('Please upload photo of received part');
      return;
    }
    setUploading(true);
    try {
      const storageRef = ref(storage, `part_received/${requestId}_${Date.now()}`);
      await uploadBytes(storageRef, damagedFile);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'partRequests', requestId), {
        status: 'Part Received',
        receivedImage: url,
        receivedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'cases', id), {
        jobStatus: 'Part Received',
        subStatus: 'Part Received - Repair In Progress',
        statusHistory: addStatusHistory('Part Received', `Part ${partName} received`),
      });
      toast.success(`Part ${partName} marked as received`);
      setShowPartReceived(null);
      setDamagedFile(null);
      fetchData();
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleMobileHandover = async () => {
    if (window.confirm('Confirm mobile handover to customer? This will close the case.')) {
      setLoading(true);
      try {
        await updateDoc(doc(db, 'cases', id), {
          jobStatus: 'Closed',
          subStatus: 'Mobile Handover to Customer',
          statusHistory: addStatusHistory('Closed', 'Mobile handover to customer'),
          closedDate: new Date().toISOString(),
        });
        toast.success('Case closed - Mobile handed over to customer');
        fetchData();
      } catch (error) {
        toast.error('Failed to close case');
      } finally {
        setLoading(false);
      }
    }
  };

  if (!caseData) {
    return <div className="flex justify-center items-center h-64"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Service Center View</h2>
        <p className="text-gray-500 mt-1">Job ID: {caseData.jobId}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Diagnosis & Status Update */}
          <div className="card">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800"><FiTool /> Diagnosis & Status Update</h3>
            <textarea rows={4} className="input-field" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Enter diagnosis, repair notes, issue details after mobile diagnosis..." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-gray-500 text-sm mb-1">Job Status</label>
                <select className="input-field" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Part Dispatch Pending">Part Dispatch Pending</option>
                  <option value="Part Dispatched">Part Dispatched</option>
                  <option value="Part Received">Part Received</option>
                  <option value="Repair Done">Repair Done</option>
                  <option value="Mobile Handover to Customer">Mobile Handover to Customer</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-500 text-sm mb-1">Sub Status</label>
                <select className="input-field" value={subStatus} onChange={(e) => setSubStatus(e.target.value)}>
                  <option value="">Select Sub Status</option>
                  <option value="Pending Only">Pending Only</option>
                  <option value="Part Request - Work In Progress">Part Request - Work In Progress</option>
                  <option value="Repair In Progress">Repair In Progress</option>
                  <option value="Repair Done">Repair Done</option>
                  <option value="Mobile Handover to Customer">Mobile Handover to Customer</option>
                </select>
              </div>
            </div>
            <button onClick={handleUpdate} disabled={loading} className="btn-primary mt-4 w-full flex items-center justify-center gap-2">
              <FiCheckCircle /> {loading ? 'Updating...' : 'Update Case'}
            </button>
          </div>

          {/* Status Timeline */}
          {statusHistory && statusHistory.length > 0 && (
            <div className="card">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800"><FiFileText /> Job Status History</h3>
              <div className="space-y-3">
                {statusHistory.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-gray-100 rounded-xl">
                    <div className="w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm text-gray-800">{entry.status}</span>
                        <span className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      {entry.note && <p className="text-sm text-gray-500 mt-1">{entry.note}</p>}
                      <p className="text-xs text-gray-400">By: {entry.updatedBy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Photos / Videos */}
          <div className="card">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800"><FiCamera /> Upload Photos / Videos</h3>
            <input type="file" multiple accept="image/*,video/*" onChange={handleFileUpload} disabled={uploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white" />
            {uploading && <p className="text-blue-600 mt-2">Uploading...</p>}
            {uploadedFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                {uploadedFiles.map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block bg-gray-200 rounded-lg overflow-hidden">
                    <img src={url} alt="upload" className="h-20 w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Upload Invoice */}
          <div className="card">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800"><FiFileText /> Upload Invoice / Documents</h3>
            <input type="file" multiple accept="application/pdf,image/*" onChange={handleInvoiceUpload} disabled={uploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-green-600 file:text-white" />
            {invoiceFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {invoiceFiles.map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
                    <FiFileText className="text-green-600" /> Invoice #{idx + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Part Requests */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-800"><FiPackage /> Part Requests</h3>
            {partRequests.map((pr) => (
              <div key={pr.id} className="border border-gray-200 rounded-lg p-3 mb-2">
                <p className="font-semibold text-gray-800">{pr.partName}</p>
                <p className="text-xs text-gray-500">Qty: {pr.quantity} | Status: <span className={`font-semibold ${pr.status === 'Approved' ? 'text-green-600' : pr.status === 'Dispatched' ? 'text-blue-600' : pr.status === 'Part Received' ? 'text-purple-600' : 'text-yellow-600'}`}>{pr.status}</span></p>
                {pr.poNumber && <p className="text-xs text-green-600">PO: {pr.poNumber} | ₹{pr.unitPrice}/pc</p>}
                {pr.courierName && <p className="text-xs text-blue-600">Courier: {pr.courierName} | Track: {pr.trackingId}</p>}
                {pr.status === 'Dispatched' && pr.status !== 'Part Received' && (
                  <button onClick={() => setShowPartReceived(pr)} className="mt-2 btn-secondary text-xs w-full flex items-center justify-center gap-1">
                    <FiCamera /> Mark as Received & Upload Photo
                  </button>
                )}
                {pr.status === 'Part Received' && <p className="text-green-600 text-xs mt-1 flex items-center gap-1"><FiCheckCircle /> Received</p>}
              </div>
            ))}
            <button onClick={() => setShowPartForm(true)} className="w-full btn-secondary text-sm flex items-center justify-center gap-2">
              <FiPlus /> Raise Part Request
            </button>
          </div>

          {/* Actions */}
          <div className="card space-y-3">
            <button onClick={() => navigate(`/part-requests/new?caseId=${id}`)} className="w-full btn-primary flex items-center justify-center gap-2">
              <FiTool /> Raise Part Request
            </button>
            {caseData.jobStatus !== 'Closed' && (
              <button onClick={handleMobileHandover} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl flex items-center justify-center gap-2 transition">
                <FiUserCheck /> {loading ? 'Processing...' : 'Mobile Handover to Customer'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Part Request Modal */}
      {showPartForm && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Raise Part Request</h3>
            <input placeholder="Part Name" className="input-field mb-3" value={partForm.partName} onChange={e => setPartForm({...partForm, partName: e.target.value})} />
            <input type="number" placeholder="Quantity" className="input-field mb-3" value={partForm.quantity} onChange={e => setPartForm({...partForm, quantity: e.target.value})} />
            <input placeholder="Variant" className="input-field mb-3" value={partForm.variant} onChange={e => setPartForm({...partForm, variant: e.target.value})} />
            <textarea placeholder="Reason" className="input-field mb-3" rows={3} value={partForm.issueDescription} onChange={e => setPartForm({...partForm, issueDescription: e.target.value})} />
            <div className="flex gap-3">
              <button onClick={handleRaisePartRequest} disabled={loading} className="btn-primary flex-1">{loading ? 'Submitting...' : 'Submit'}</button>
              <button onClick={() => setShowPartForm(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Part Received Modal */}
      {showPartReceived && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Part Received: {showPartReceived.partName}</h3>
            <div className="mb-4">
              <label className="block text-gray-600 mb-2">Upload Photo of Received Part</label>
              <input type="file" accept="image/*" onChange={e => setDamagedFile(e.target.files[0])} />
            </div>
            <button onClick={() => handlePartReceived(showPartReceived.id, showPartReceived.partName)} disabled={uploading} className="btn-primary w-full mb-2">
              {uploading ? 'Uploading...' : 'Confirm Received'}
            </button>
            <button onClick={() => setShowPartReceived(null)} className="btn-secondary w-full">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

