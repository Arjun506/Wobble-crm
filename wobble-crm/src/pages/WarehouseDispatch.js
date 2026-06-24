import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import { FiTruck, FiUpload } from 'react-icons/fi';
import { sendAllNotifications } from '../utils/messaging';

export default function WarehouseDispatch() {
  const [requests, setRequests] = useState([]);
  const [dispatchQuantities, setDispatchQuantities] = useState({});
  const [dispatchFiles, setDispatchFiles] = useState({});
  const [courierDetails, setCourierDetails] = useState({});
  const [dispatchDates, setDispatchDates] = useState({});
  const [expectedDeliveryDates, setExpectedDeliveryDates] = useState({});
  const [courierContacts, setCourierContacts] = useState({});
  const [dispatchNotes, setDispatchNotes] = useState({});
  const [packageWeights, setPackageWeights] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const q = query(collection(db, 'partRequests'), where('status', '==', 'Approved'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setRequests(data);
      const qtyMap = {};
      data.forEach(req => { qtyMap[req.id] = req.quantity; });
      setDispatchQuantities(qtyMap);
    } catch (error) {
      toast.error('Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (id, value) => {
    setDispatchQuantities(prev => ({ ...prev, [id]: parseInt(value) || 0 }));
  };

  const handleFileChange = (id, file) => {
    setDispatchFiles(prev => ({ ...prev, [id]: file }));
  };

  const handleCourierChange = (id, field, value) => {
    setCourierDetails(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleDispatch = async (requestId, caseId, requestedQty, caseData) => {
    const dispatchQty = dispatchQuantities[requestId];
    const receiptFile = dispatchFiles[requestId];
    const courier = courierDetails[requestId];

    if (!dispatchQty || dispatchQty <= 0) {
      toast.error('Enter valid quantity');
      return;
    }
    if (dispatchQty > requestedQty) {
      toast.error('Cannot dispatch more than requested');
      return;
    }
    if (!receiptFile) {
      toast.error('Please upload dispatch receipt');
      return;
    }
    if (!courier?.name || !courier?.trackingId) {
      toast.error('Please enter courier name and tracking ID');
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `dispatch_receipts/${requestId}_${Date.now()}`);
      await uploadBytes(storageRef, receiptFile);
      const receiptUrl = await getDownloadURL(storageRef);

      await updateDoc(doc(db, 'partRequests', requestId), {
        status: 'Dispatched',
        dispatchedQuantity: dispatchQty,
        dispatchDate: dispatchDates[requestId] || new Date().toISOString(),
        dispatchReceipt: receiptUrl,
        courierName: courier.name,
        trackingId: courier.trackingId,
        courierContact: courierContacts[requestId] || '',
        expectedDeliveryDate: expectedDeliveryDates[requestId] || '',
        dispatchNotes: dispatchNotes[requestId] || '',
        packageWeight: packageWeights[requestId] || '',
      });
      await updateDoc(doc(db, 'cases', caseId), { jobStatus: 'Part Dispatched' });
      
      // Send dispatch notification to customer
      if (caseData) {
        const dispatchMsg = `Dear ${caseData.customerName}, your part for case ${caseData.jobId} has been dispatched! Courier: ${courier.name}, Tracking ID: ${courier.trackingId}. Expected delivery: ${expectedDeliveryDates[requestId] || 'Soon'}. - Wobble One`;
        try {
          await sendAllNotifications(
            caseData.mobileNumber,
            caseData.email,
            caseData.customerName,
            caseData.jobId,
            caseData.deviceModel,
            'Part Dispatched',
            dispatchMsg
          );
        } catch (notifErr) {
          console.error('Notification error:', notifErr);
        }
      }
      
      toast.success('Part dispatched & customer notified');
      fetchRequests();
      setDispatchFiles({});
      setCourierDetails({});
      setDispatchDates({});
      setExpectedDeliveryDates({});
      setCourierContacts({});
      setDispatchNotes({});
      setPackageWeights({});
    } catch (error) {
      toast.error('Dispatch failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Warehouse Dispatch</h2>
        <p className="text-gray-500 mt-1">Dispatch approved parts with receipt and courier details</p>
      </div>

      {requests.length === 0 ? (
        <div className="card text-center py-12"><div className="text-6xl mb-4">📦</div><p className="text-gray-500">No approved part requests waiting for dispatch.</p></div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="card">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2"><span className="badge-blue">Approved</span><span className="font-mono text-sm">{req.jobId}</span></div>
                  <h3 className="text-lg font-semibold text-gray-800">{req.partName}</h3>
                  <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                    <div><p className="text-gray-400 text-xs">Requested Qty</p><p className="text-gray-700">{req.quantity}</p></div>
                    <div><p className="text-gray-400 text-xs">Customer</p><p className="text-gray-700">{req.customerName}</p></div>
                    <div><p className="text-gray-400 text-xs">PO Number</p><p className="text-gray-700">{req.poNumber || 'N/A'}</p></div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-24"><input type="number" min="1" max={req.quantity} value={dispatchQuantities[req.id] || ''} onChange={e => updateQuantity(req.id, e.target.value)} className="input-field text-center" placeholder="Qty" /></div>
                    <div>
                      <label className="cursor-pointer bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-3 rounded-xl text-sm flex items-center gap-2">
                        <FiUpload /> Receipt
                        <input type="file" accept="image/*,application/pdf" onChange={e => handleFileChange(req.id, e.target.files[0])} className="hidden" />
                      </label>
                      {dispatchFiles[req.id] && <p className="text-xs text-green-600 mt-1">File selected</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Courier Name" className="input-field text-sm" onChange={e => handleCourierChange(req.id, 'name', e.target.value)} />
                    <input type="text" placeholder="Tracking ID" className="input-field text-sm" onChange={e => handleCourierChange(req.id, 'trackingId', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" placeholder="Dispatch Date" className="input-field text-sm" value={dispatchDates[req.id] || ''} onChange={e => setDispatchDates(prev => ({ ...prev, [req.id]: e.target.value }))} />
                    <input type="date" placeholder="Expected Delivery" className="input-field text-sm" value={expectedDeliveryDates[req.id] || ''} onChange={e => setExpectedDeliveryDates(prev => ({ ...prev, [req.id]: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Courier Contact" className="input-field text-sm" value={courierContacts[req.id] || ''} onChange={e => setCourierContacts(prev => ({ ...prev, [req.id]: e.target.value }))} />
                    <input type="text" placeholder="Package Weight (kg)" className="input-field text-sm" value={packageWeights[req.id] || ''} onChange={e => setPackageWeights(prev => ({ ...prev, [req.id]: e.target.value }))} />
                  </div>
                  <textarea placeholder="Dispatch Notes / Remarks" className="input-field text-sm" rows={2} value={dispatchNotes[req.id] || ''} onChange={e => setDispatchNotes(prev => ({ ...prev, [req.id]: e.target.value }))} />
                  <button onClick={() => handleDispatch(req.id, req.caseId, req.quantity)} disabled={uploading} className="btn-primary w-full flex items-center justify-center gap-2"><FiTruck /> Dispatch</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

