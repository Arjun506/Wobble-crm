import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { FiTool } from 'react-icons/fi';
import { sendAllNotifications } from '../utils/messaging';

export default function PartRequestForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const caseId = searchParams.get('caseId');
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    partName: '',
    quantity: 1,
    variant: '',
    issueDescription: '',
  });

  useEffect(() => {
    if (caseId) fetchCase();
  }, [caseId]);

  const fetchCase = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'cases', caseId));
      if (docSnap.exists()) {
        setCaseData({ id: docSnap.id, ...docSnap.data() });
      } else {
        toast.error('Case not found');
        navigate('/cases/search');
      }
    } catch (error) {
      toast.error('Error fetching case');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.partName) {
      toast.error('Part name required');
      return;
    }
    setLoading(true);
    try {
      const partData = {
        caseId,
        partName: formData.partName,
        quantity: Number(formData.quantity),
        variant: formData.variant,
        issueDescription: formData.issueDescription,
        status: 'Pending Approval',
        requestedAt: new Date().toISOString(),
      };
      const partRef = await addDoc(collection(db, 'partRequests'), partData);
      
      // Send notification to customer about part request
      const notificationMsg = `Dear ${caseData.customerName}, we have received a part request for your case ${caseData.jobId}. Part: ${formData.partName}, Qty: ${Number(formData.quantity)}. This will be reviewed and you'll be notified shortly. - Wobble One`;
      
      try {
        await sendAllNotifications(
          caseData.mobileNumber,
          caseData.email,
          caseData.customerName,
          caseData.jobId,
          caseData.deviceModel,
          'Part Request: ' + formData.partName,
          notificationMsg
        );
      } catch (notifErr) {
        console.error('Notification error:', notifErr);
      }
      
      toast.success('Part request submitted & customer notified');
      navigate('/cases/search');
    } catch (error) {
      toast.error('Submission failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <FiTool className="text-orange-500" /> Raise Part Request
      </h2>
      {caseData && (
        <div className="card mb-6 bg-blue-50 dark:bg-blue-900/20">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-semibold">Case ID:</span> {caseData.jobId}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-semibold">Customer:</span> {caseData.customerName} | {caseData.mobileNumber}
          </p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="form-label">Part Name *</label>
          <input
            type="text"
            value={formData.partName}
            onChange={e => setFormData({...formData, partName: e.target.value})}
            className="input-field"
            placeholder="e.g. Display, Battery"
            required
          />
        </div>
        <div>
          <label className="form-label">Quantity</label>
          <input
            type="number"
            min="1"
            value={formData.quantity}
            onChange={e => setFormData({...formData, quantity: e.target.value})}
            className="input-field"
          />
        </div>
        <div>
          <label className="form-label">Variant</label>
          <input
            type="text"
            value={formData.variant}
            onChange={e => setFormData({...formData, variant: e.target.value})}
            className="input-field"
            placeholder="e.g. 6GB/128GB Black"
          />
        </div>
        <div>
          <label className="form-label">Issue Description</label>
          <textarea
            rows={3}
            value={formData.issueDescription}
            onChange={e => setFormData({...formData, issueDescription: e.target.value})}
            className="input-field"
            placeholder="Describe the issue..."
          />
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
          <button type="button" onClick={() => navigate('/cases/search')} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
