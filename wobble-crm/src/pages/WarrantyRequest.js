import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';

import { FiSave, FiSearch, FiFileText } from 'react-icons/fi';
import WarrantyReceiptModal from '../components/WarrantyReceiptModal';
import { sendAllNotifications } from '../utils/messaging';


export default function WarrantyRequest() {


  const [imei, setImei] = useState('');
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);

  const searchDevice = async () => {
    if (!imei) return toast.error('Enter IMEI');
    setLoading(true);
    try {
      const q = query(collection(db, 'devices'), where('imei', '==', imei));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        toast.error('Device not found');
        setDevice(null);
      } else {
        setDevice({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const requestWarranty = async () => {
    if (!device) return;
    if (!reason) return toast.error('Please provide reason');
    setLoading(true);
    try {
      await addDoc(collection(db, 'warrantyRequests'), {
        imei: device.imei,
        customerName: device.customerName,
        mobileNumber: device.mobileNumber,
        email: device.email,
        requestDate: new Date().toISOString(),
        status: 'Pending',
        extendedYears: 1,
        reason: reason,
      });
      
      // Send warranty request notification to customer
      const warrantyMsg = `Dear ${device.customerName}, we have received your warranty extension request for device ${device.imei}. This will be reviewed and you'll be notified about the status within 24-48 hours. - Wobble One`;
      try {
        await sendAllNotifications(
          device.mobileNumber,
          device.email,
          device.customerName,
          device.imei,
          device.deviceModel || 'Device',
          'Warranty Extension Request',
          warrantyMsg
        );
      } catch (notifErr) {
        console.error('Notification error:', notifErr);
      }
      
      toast.success('Warranty extension request sent & customer notified');
      setReason('');
    } catch (error) {
      toast.error('Request failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold">Extended Warranty Request</h2>
        <p className="text-gray-500">Request +1 year warranty for device</p>
      </div>
      <div className="card mb-6">
        <div className="flex gap-4">
          <input type="text" placeholder="Enter IMEI" value={imei} onChange={e => setImei(e.target.value)} className="input-field flex-1" />
          <button onClick={searchDevice} disabled={loading} className="btn-primary flex items-center gap-2">
            <FiSearch /> Search
          </button>
        </div>
      </div>
      {device && (
        <div className="card space-y-4">
          <h3 className="text-xl font-semibold">Device Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <p><strong>IMEI:</strong> <span className="font-mono">{device.imei}</span></p>
            <p><strong>Customer:</strong> {device.customerName}</p>
            <p><strong>Mobile:</strong> {device.mobileNumber || 'N/A'}</p>
            <p><strong>Email:</strong> {device.email || 'N/A'}</p>
            <p><strong>Purchase Date:</strong> {new Date(device.purchaseDate).toLocaleDateString()}</p>
            <p><strong>Current Warranty Expiry:</strong> {device.warrantyExpiry ? new Date(device.warrantyExpiry).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Extended Warranty:</strong> {device.extendedWarranty ? 'Yes' : 'No'}</p>
          </div>

          {device.extendedWarranty ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-green-700 font-semibold mb-3">&#9989; Extended warranty is already active on this device!</p>
              <button
                onClick={() => setShowReceipt(true)}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <FiFileText /> Generate & Share Warranty Receipt
              </button>
            </div>
          ) : (
            <>
              <textarea placeholder="Reason for extension" rows={3} className="input-field" value={reason} onChange={e => setReason(e.target.value)} />
              <button onClick={requestWarranty} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                <FiSave /> {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </>
          )}
        </div>
      )}

      <WarrantyReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        deviceData={device}
      />
    </div>
  );
}

