import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';

import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiAlertCircle, FiChevronRight, FiChevronLeft } from 'react-icons/fi';
import { sendAllNotifications } from '../utils/messaging';
import { useAuth } from '../contexts/AuthContext';

export default function CaseRegister() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    mobileNumber: '',
    alternateNumber: '',
    email: '',
    addressPin: '',
    addressLocality: '',
    addressCity: '',
    deviceBrand: '',
    deviceModel: '',
    deviceVariant: '',
    deviceColor: '',
    imei1: '',
    imei2: '',
    purchaseDate: '',
    issueType: '',
    subIssueType: '',
  });

  const issueTypes = [
    'Display Issue',
    'Battery Issue',
    'Charging Port',
    'Camera Problem',
    'Speaker Issue',
    'Microphone Problem',
    'Water Damage',
    'Software Problem',
    'Network Issue',
    'Physical Damage',
    'Motherboard Issue',
    'Other',
  ];

  const deviceOptions = [
    'ACER SUPER ZX',
    'WOBBLE ONE',
  ];

  const variantOptions = [
    '8 / 128 GB',
    '8 / 256 GB',
    '12 / 256 GB',
    '6 / 128 GB',
    '4 / 128 GB',
  ];

  const colorOptions = [
    'Carbon Black',
    'Lunar Blue',
    'Cosmic Green',
    'Eclipse Black',
    'Mythic White',
    'Nova Blue',
  ];

  const generateJobId = () => {
    const prefix = 'WOB';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}${timestamp}${random}`;
  };

  const calculateWarranty = (purchaseDate) => {
    if (!purchaseDate) return 'Unknown';
    const diffMonths = (new Date() - new Date(purchaseDate)) / (1000 * 60 * 60 * 24 * 30);
    return diffMonths <= 12 ? 'In Warranty ✅' : 'Out of Warranty ⚠️';
  };

  const checkDuplicateOpenCase = async (mobileNumber, imei1, alternateNumber) => {
    const snapshot = await getDocs(collection(db, 'cases'));
    const allCases = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const openCases = allCases.filter(c => c.jobStatus !== 'Closed');
    return openCases.find(c => 
      c.mobileNumber === mobileNumber || 
      c.imei1 === imei1 || 
      (alternateNumber && c.alternateNumber === alternateNumber)
    );
  };

  const handleSubmit = async () => {
    if (!formData.customerName || !formData.mobileNumber) {
      toast.error('Customer Name and Mobile Number required');
      return;
    }
    setLoading(true);
    try {
      const existing = await checkDuplicateOpenCase(formData.mobileNumber, formData.imei1, formData.alternateNumber);
      if (existing) {
        toast.custom((t) => (
          <div className="bg-orange-500 text-white p-4 rounded-xl shadow-xl max-w-md">
            <div className="flex items-center gap-3">
              <FiAlertCircle size={24} />
              <div>
                <p className="font-bold">Open case already exists!</p>
                <p>Job ID: {existing.jobId}</p>
                <p>Status: {existing.jobStatus}</p>
                <p>Customer: {existing.customerName}</p>
                <button onClick={() => navigate(`/case/${existing.id}`)} className="mt-2 bg-white text-orange-600 px-3 py-1 rounded-lg text-sm">View Case</button>
              </div>
            </div>
          </div>
        ), { duration: 8000 });
        return;
      }
      const jobId = generateJobId();
      const caseData = {
        ...formData,
        jobId,
        warranty: calculateWarranty(formData.purchaseDate),
        caseRegisterDate: serverTimestamp(),
        jobStatus: 'Open',
        diagnosis: '',
        createdAt: serverTimestamp(),
        createdBy: user?.email || 'anonymous',
        createdByUid: user?.id || null,
        previousIssues: [],
        photos: [],
        jobNotes: [],
        partRequests: [],
        updatedAt: serverTimestamp(),
        reminderSent: false,
        reminderCount: 0,
      };
      const docRef = await addDoc(collection(db, 'cases'), caseData);
      const newCase = { id: docRef.id, ...caseData };
      
      // Send auto notifications using the utility (non-blocking)
      try {
        const notifResults = await sendAllNotifications(
          newCase.mobileNumber,
          newCase.email,
          newCase.customerName,
          newCase.jobId,
          newCase.deviceModel,
          newCase.issueType
        );
        console.log('Notification results:', notifResults);
        toast.success(`Case registered! Job ID: ${jobId}`);
        if (notifResults.whatsapp?.mock || notifResults.sms?.mock || notifResults.email?.mock) {
          toast('Notifications sent in mock mode — add Twilio/EmailJS credentials to server/.env for real delivery', { icon: '⚠️', duration: 5000 });
        }
      } catch (notifErr) {
        console.error('Notification error (non-blocking):', notifErr);
        toast.success(`Case registered! Job ID: ${jobId}`);
        toast.error('Case saved but notification failed — check server/.env credentials');
      }
      navigate(`/case/${docRef.id}`);
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const stepHint = {
    1: 'Fill the customer contact and address details to start the case registration.',
    2: 'Select device model, variant and color, then enter imei details for the mobile.',
    3: 'Choose the issue type and add any sub issue information to help the technician.',
  };

  return (
    <div className="min-h-screen py-12 bg-slate-100">
      <div className="max-w-7xl mx-auto px-4">
        <div className="rounded-[2rem] border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-8 text-white">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-3xl font-bold">Register New Case</h2>
                <p className="mt-2 text-sm text-blue-100 max-w-2xl">Start with customer details, then add the device and issue information in the same full-width registration form.</p>
              </div>
              <div className="rounded-3xl bg-white/10 border border-white/15 px-4 py-3 text-sm font-semibold">Step {step} of 3</div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {['Customer', 'Device', 'Issue'].map((label, index) => (
                <div key={label} className={`rounded-3xl px-4 py-3 text-center text-sm ${step === index + 1 ? 'bg-white text-slate-900 shadow-lg' : 'bg-white/10 text-blue-100'}`}>
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="p-8">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <div className="mb-6 rounded-3xl border border-dashed border-slate-200 bg-white/80 p-5 text-sm text-slate-700">
                <p className="font-semibold">What to update</p>
                <p className="mt-2 text-slate-600">{stepHint[step]}</p>
              </div>

              {step > 1 && (
                <div className="mb-6 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Customer</p>
                    <p className="mt-2 font-semibold text-slate-900">{formData.customerName || 'Not set yet'}</p>
                    <p className="mt-1 text-sm text-slate-500">{formData.mobileNumber || 'Mobile not entered'}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Device</p>
                    <p className="mt-2 font-semibold text-slate-900">{formData.deviceModel || 'Model pending'}</p>
                    <p className="mt-1 text-sm text-slate-500">{formData.deviceVariant || 'Variant pending'}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Color</p>
                    <p className="mt-2 font-semibold text-slate-900">{formData.deviceColor || 'Not selected'}</p>
                    <p className="mt-1 text-sm text-slate-500">{formData.imei1 ? `IMEI 1 • ${formData.imei1}` : 'IMEI pending'}</p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="customerName" value={formData.customerName} onChange={handleChange} placeholder="Full Name *" className="input-field" required />
                    <input name="mobileNumber" value={formData.mobileNumber} onChange={handleChange} placeholder="Mobile Number *" className="input-field" required />
                    <input name="alternateNumber" value={formData.alternateNumber} onChange={handleChange} placeholder="Alternate Number" className="input-field" />
                    <input name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="input-field" />
                    <input name="addressPin" value={formData.addressPin} onChange={handleChange} placeholder="PIN Code" className="input-field" />
                    <input name="addressLocality" value={formData.addressLocality} onChange={handleChange} placeholder="Locality" className="input-field" />
                    <div className="md:col-span-2"><input name="addressCity" value={formData.addressCity} onChange={handleChange} placeholder="City" className="input-field" /></div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button onClick={nextStep} className="btn-primary flex-1 flex items-center justify-center gap-2">Next <FiChevronRight /></button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Device Model</label>
                      <select name="deviceModel" value={formData.deviceModel} onChange={handleChange} className="input-field">
                        <option value="">Select model</option>
                        {deviceOptions.map(model => <option key={model} value={model}>{model}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Variant</label>
                      <select name="deviceVariant" value={formData.deviceVariant} onChange={handleChange} className="input-field">
                        <option value="">Select variant</option>
                        {variantOptions.map(variant => <option key={variant} value={variant}>{variant}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
                      <select name="deviceColor" value={formData.deviceColor} onChange={handleChange} className="input-field">
                        <option value="">Select color</option>
                        {colorOptions.map(color => <option key={color} value={color}>{color}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Purchase Date</label>
                      <input name="purchaseDate" type="date" value={formData.purchaseDate} onChange={handleChange} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">IMEI 1</label>
                      <input name="imei1" value={formData.imei1} onChange={handleChange} placeholder="IMEI 1" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">IMEI 2</label>
                      <input name="imei2" value={formData.imei2} onChange={handleChange} placeholder="IMEI 2" className="input-field" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button onClick={prevStep} className="btn-secondary flex items-center justify-center gap-2"><FiChevronLeft /> Back</button>
                    <button onClick={nextStep} className="btn-primary flex-1 flex items-center justify-center gap-2">Next <FiChevronRight /></button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Issue Type</label>
                      <select name="issueType" value={formData.issueType} onChange={handleChange} className="input-field">
                        <option value="">Select issue type</option>
                        {issueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Sub Issue / Notes</label>
                      <input name="subIssueType" value={formData.subIssueType} onChange={handleChange} placeholder="Sub issue or extra notes" className="input-field" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button onClick={prevStep} className="btn-secondary flex items-center justify-center gap-2"><FiChevronLeft /> Back</button>
                    <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2"><FiSave /> {loading ? 'Processing...' : 'Register Case'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}