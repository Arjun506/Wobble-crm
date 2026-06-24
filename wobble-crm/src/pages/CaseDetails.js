import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { 
  FiUser, FiPhone, FiMail, FiMapPin, FiPhoneCall, FiCpu, FiEdit2, FiSave, FiX, 
  FiClock, FiPrinter, FiFileText, FiCalendar, FiMessageSquare, FiDownload, FiSend,
  FiTool, FiPlusCircle, FiSmartphone
} from 'react-icons/fi';
import { sendWhatsApp, sendSMS, sendEmail, messageTemplates, templateLabels } from '../utils/messaging';
import { handleCaseStatusChange, checkAndSendAutoCloseReminder } from '../utils/caseStatusHandler';

export default function CaseDetails() {
  const { id } = useParams();
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('whatsapp');
  const [toAddress, setToAddress] = useState({
    whatsapp: '8123889977',
    sms: '8123889977',
    email: 'support@wobble.in',
  });

  const [selectedTemplate, setSelectedTemplate] = useState('greeting');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messageMode, setMessageMode] = useState('template');
  const [serverMockMode, setServerMockMode] = useState({ sms: true, email: true });

  const fetchCaseData = useCallback(async () => {
    try {
      const docRef = doc(db, 'cases', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setCaseData(data);
        setEditData(data);

        // Check for auto-close reminder
        if (data.jobStatus === 'Open') {
          const reminderNeeded = await checkAndSendAutoCloseReminder(data);
          if (reminderNeeded === true) {
            toast('Auto-close reminder sent to customer', { icon: '📬' });
          } else if (reminderNeeded === 'auto-close-needed') {
            toast.custom((t) => (
              <div className="bg-red-500 text-white p-4 rounded-xl shadow-xl">
                <p className="font-bold">Case is eligible for auto-close</p>
                <p className="text-sm mt-1">This case is 7+ days old. Consider closing it or contacting the customer.</p>
              </div>
            ), { duration: 5000 });
          }
        }
      } else {
        toast.error('Case not found');
        navigate('/cases/search');
      }
    } catch (error) {
      console.error('Error fetching case data:', error);
      toast.error('Error fetching case');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchCaseData();
  }, [fetchCaseData]);

  useEffect(() => {
    if (showMessageModal) {
      fetch('http://localhost:5000/api/health')
        .then(r => r.json())
        .then(data => {
          if (data.mockMode) setServerMockMode(data.mockMode);
        })
        .catch(() => setServerMockMode({ sms: true, email: true }));
    }
  }, [showMessageModal]);

  const handleEdit = () => setIsEditing(true);
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData(caseData);
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'cases', id), {
        customerName: editData.customerName,
        mobileNumber: editData.mobileNumber,
        alternateNumber: editData.alternateNumber,
        email: editData.email,
        addressLocality: editData.addressLocality,
        addressCity: editData.addressCity,
        addressPin: editData.addressPin,
        updatedAt: new Date().toISOString(),
      });
      toast.success('Customer details updated');
      setIsEditing(false);
      await fetchCaseData();
    } catch (error) {
      toast.error('Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error('Please enter a note');
      return;
    }
    const existingNotes = caseData.jobNotes || [];
    const updatedNotes = [...existingNotes, {
      id: Date.now(),
      text: newNote,
      date: new Date().toISOString(),
      author: role,
      authorName: user?.email?.split('@')[0] || (role === 'service' ? 'Service Engineer' : 'Call Center Agent')
    }];
    try {
      await updateDoc(doc(db, 'cases', id), { jobNotes: updatedNotes });
      toast.success('Note added');
      setNewNote('');
      setShowNotesModal(false);
      await fetchCaseData();
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  const handleInputChange = (e) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Open': 'badge-green',
      'Closed': 'badge-gray',
      'In Progress': 'badge-yellow',
      'Pending Approval': 'badge-orange',
      'Part Dispatched': 'badge-blue',
      'Part Received': 'badge-purple',
    };
    return badges[status] || 'badge-gray';
  };

  const calculateDaysOld = () => {
    if (!caseData?.caseRegisterDate) return 0;
    const diff = Math.ceil((new Date() - new Date(caseData.caseRegisterDate)) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getPreviewMessage = () => {
    if (!caseData) return '';
    const tpl = messageTemplates[selectedChannel][selectedTemplate];
    return selectedTemplate === 'custom' ? customMessage : tpl(caseData);
  };

  const handleSendMessage = async () => {
    const message = getPreviewMessage();
    if (!message.trim()) {
      toast.error('Message cannot be empty');
      return;
    }
    setSending(true);
    try {
      let result;
      if (selectedChannel === 'whatsapp') {
        const to = caseData.mobileNumber || toAddress.whatsapp;
        if (!to) {
          toast.error('WhatsApp number missing');
          return;
        }
        result = await sendWhatsApp(to, message, caseData.jobId);
      } else if (selectedChannel === 'sms') {
        const to = caseData.mobileNumber || toAddress.sms;
        if (!to) {
          toast.error('SMS number missing');
          return;
        }
        result = await sendSMS(to, message, caseData.jobId);
      } else if (selectedChannel === 'email') {
        const to = caseData.email || toAddress.email;
        if (!to) {
          toast.error('Email address missing');
          return;
        }
        result = await sendEmail(to, `Update on your case ${caseData.jobId}`, message, {
          job_id: caseData.jobId,
          customer_name: caseData.customerName,
        });
      }
      if (result?.success) {
        toast.success(`Message sent via ${selectedChannel.toUpperCase()}${result.mock ? ' (mock mode)' : ''}`);
        setShowMessageModal(false);
        setCustomMessage('');
      } else {
        toast.error(result?.error || `Failed to send ${selectedChannel}`);
      }
    } catch (error) {
      toast.error('Failed to send message: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handlePrintReceipt = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Receipt - ${caseData.jobId}</title><style>body{font-family:'Segoe UI',Arial;padding:40px;background:white}.header{text-align:center;border-bottom:3px solid #3b82f6;padding-bottom:20px}.logo{font-size:28px;font-weight:bold}.case-id{background:#f1f5f9;padding:15px;border-radius:12px;margin:20px 0}.row{display:flex;margin:10px 0;padding:8px;border-bottom:1px solid #e2e8f0}.label{font-weight:bold;width:150px}</style></head><body><div class="header"><div class="logo">Wobble One CRM</div><div class="subtitle">Service Receipt</div></div><div class="case-id"><span>Case ID: ${caseData.jobId}</span></div><div class="details"><div class="row"><div class="label">Customer:</div><div>${caseData.customerName}</div></div><div class="row"><div class="label">Mobile:</div><div>${caseData.mobileNumber}</div></div><div class="row"><div class="label">Device:</div><div>${caseData.deviceModel || 'N/A'}</div></div><div class="row"><div class="label">Issue:</div><div>${caseData.issueType || 'N/A'}</div></div><div class="row"><div class="label">Status:</div><div>${caseData.jobStatus}</div></div><div class="row"><div class="label">Date:</div><div>${new Date().toLocaleString()}</div></div></div><div class="footer">Thank you for choosing Wobble One Service</div></body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintJobReport = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Job Report - ${caseData.jobId}</title><style>body{font-family:'Segoe UI',Arial;padding:40px;background:white}.header{text-align:center;border-bottom:3px solid #3b82f6}.section{margin:25px 0}.section-title{font-size:18px;font-weight:bold;color:#2563eb;border-left:4px solid #3b82f6;padding-left:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.info-card{background:#f8fafc;padding:12px;border-radius:10px}</style></head><body><div class="header"><div class="logo">Wobble One CRM</div><div class="subtitle">Job Report</div></div><div class="section"><div class="section-title">Case Information</div><div class="grid"><div class="info-card"><div class="label">Job ID</div><div>${caseData.jobId}</div></div><div class="info-card"><div class="label">Status</div><div>${caseData.jobStatus}</div></div><div class="info-card"><div class="label">Registered</div><div>${new Date(caseData.caseRegisterDate).toLocaleString()}</div></div></div></div><div class="section"><div class="section-title">Customer Details</div><div class="grid"><div class="info-card"><div class="label">Name</div><div>${caseData.customerName}</div></div><div class="info-card"><div class="label">Mobile</div><div>${caseData.mobileNumber}</div></div></div></div><div class="section"><div class="section-title">Device & Issue</div><div class="grid"><div class="info-card"><div class="label">Device</div><div>${caseData.deviceModel || 'N/A'}</div></div><div class="info-card"><div class="label">IMEI</div><div>${caseData.imei1 || 'N/A'}</div></div><div class="info-card"><div class="label">Issue</div><div>${caseData.issueType || 'N/A'}</div></div><div class="info-card"><div class="label">Diagnosis</div><div>${caseData.diagnosis || 'Pending'}</div></div></div></div></body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="loading-spinner"></div></div>;
  }

  if (!caseData) return null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-800">Case Details</h2>
              <span className={`badge ${getStatusBadge(caseData.jobStatus)}`}>{caseData.jobStatus}</span>
            </div>
            <div className="mt-3">
              <p className="text-gray-500 text-sm">Case ID:</p>
              <p className="text-2xl font-bold font-mono bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{caseData.jobId}</p>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1"><FiCalendar size={14} /> Registered: {new Date(caseData.caseRegisterDate).toLocaleDateString()}</span>
              <span className="flex items-center gap-1"><FiClock size={14} /> {calculateDaysOld()} days old</span>
            </div>
          </div>
          <div className="flex gap-3">
            {role === 'admin' && (
              <button onClick={() => navigate('/reports')} className="btn-primary flex items-center gap-2 text-sm"><FiDownload /> Export</button>
            )}
            <button onClick={() => setShowMessageModal(true)} className="btn-primary flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700">
              <FiSend /> Send Message
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2"><FiUser className="text-blue-500" /> Customer Information</h3>
              {!isEditing && (role === 'admin' || role === 'callcenter') && (
                <button onClick={handleEdit} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"><FiEdit2 size={14} /> Edit</button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input name="customerName" value={editData.customerName || ''} onChange={handleInputChange} placeholder="Full Name" className="input-field" />
                  <input name="mobileNumber" value={editData.mobileNumber || ''} onChange={handleInputChange} placeholder="Mobile" className="input-field" />
                  <input name="alternateNumber" value={editData.alternateNumber || ''} onChange={handleInputChange} placeholder="Alternate" className="input-field" />
                  <input name="email" value={editData.email || ''} onChange={handleInputChange} placeholder="Email" className="input-field" />
                  <input name="addressLocality" value={editData.addressLocality || ''} onChange={handleInputChange} placeholder="Locality" className="input-field" />
                  <input name="addressCity" value={editData.addressCity || ''} onChange={handleInputChange} placeholder="City" className="input-field" />
                  <input name="addressPin" value={editData.addressPin || ''} onChange={handleInputChange} placeholder="PIN" className="input-field" />
                </div>
                <div className="flex gap-3"><button onClick={handleSaveEdit} className="btn-primary"><FiSave /> Save</button><button onClick={handleCancelEdit} className="btn-secondary"><FiX /> Cancel</button></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl"><FiUser className="text-blue-500 mt-1" /><div><p className="text-gray-500 text-xs">Full Name</p><p className="font-semibold text-gray-800">{caseData.customerName}</p></div></div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl"><FiPhone className="text-green-500 mt-1" /><div><p className="text-gray-500 text-xs">Mobile</p><p className="text-gray-800">{caseData.mobileNumber}</p></div></div>
                {caseData.alternateNumber && <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl"><FiPhoneCall className="text-yellow-500 mt-1" /><div><p className="text-gray-500 text-xs">Alternate</p><p className="text-gray-800">{caseData.alternateNumber}</p></div></div>}
                {caseData.email && <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl"><FiMail className="text-purple-500 mt-1" /><div><p className="text-gray-500 text-xs">Email</p><p className="text-gray-800">{caseData.email}</p></div></div>}
                <div className="md:col-span-2 flex items-start gap-3 p-3 bg-gray-50 rounded-xl"><FiMapPin className="text-red-500 mt-1" /><div><p className="text-gray-500 text-xs">Address</p><p className="text-gray-800">{caseData.addressLocality ? `${caseData.addressLocality}, ` : ''}{caseData.addressCity || ''}{caseData.addressPin ? ` - ${caseData.addressPin}` : ''}</p></div></div>
              </div>
            )}
          </div>

          {/* Device & Issue Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2"><FiCpu className="text-purple-500" /> Device & Issue</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-gray-500 text-xs">Model</p><p className="font-medium text-gray-800">{caseData.deviceModel || 'N/A'}</p></div>
              <div><p className="text-gray-500 text-xs">Variant</p><p className="text-gray-800">{caseData.deviceVariant || 'N/A'}</p></div>
              <div><p className="text-gray-500 text-xs">Color</p><p className="text-gray-800">{caseData.deviceColor || 'N/A'}</p></div>
              <div><p className="text-gray-500 text-xs">Purchase Date</p><p className="text-gray-800">{caseData.purchaseDate ? new Date(caseData.purchaseDate).toLocaleDateString() : 'N/A'}</p></div>
              <div className="col-span-2"><p className="text-gray-500 text-xs">IMEI</p><p className="font-mono text-sm text-gray-800">{caseData.imei1 || 'N/A'}</p>{caseData.imei2 && <p className="font-mono text-sm mt-1">{caseData.imei2}</p>}</div>
              <div><p className="text-gray-500 text-xs">Warranty</p><p className={caseData.warranty?.includes('In') ? 'text-green-600 font-semibold' : 'text-red-600'}>{caseData.warranty || 'Unknown'}</p></div>
              <div><p className="text-gray-500 text-xs">Issue Type</p><p className="text-gray-800">{caseData.issueType || 'N/A'}</p></div>
              <div className="col-span-2"><p className="text-gray-500 text-xs">Sub Issue</p><p className="text-gray-800">{caseData.subIssueType || 'N/A'}</p></div>
              <div className="col-span-2"><p className="text-gray-500 text-xs">Diagnosis</p><p className="text-gray-800">{caseData.diagnosis || 'Pending'}</p></div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">Service Center</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Center ID:</span><span className="font-mono">{caseData.serviceCenterId || 'SC-WBL-001'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Center Name:</span><span>{caseData.serviceCenterName || 'Wobble One Main Center'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Contact:</span><span>{caseData.serviceCenterContact || '+91 98765 43210'}</span></div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-2xl shadow-lg p-6 border border-amber-200">
            <h3 className="text-lg font-semibold text-amber-800 mb-3 flex items-center gap-2"><FiMessageSquare className="text-amber-600" /> Job Notes</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {caseData.jobNotes && caseData.jobNotes.length > 0 ? (
                caseData.jobNotes.map((note, idx) => (
                  <div key={note.id || idx} className="p-3 bg-white rounded-xl shadow-sm border border-amber-100">
                    <div className="flex justify-between text-xs text-amber-700 mb-1">
                      <span className="font-medium">{note.authorName || note.author}</span>
                      <span>{new Date(note.date).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-700">{note.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No notes added</p>
              )}
            </div>
            <button onClick={() => setShowNotesModal(true)} className="w-full mt-3 btn-secondary text-sm flex items-center justify-center gap-2"><FiMessageSquare /> Add Note</button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Actions</h3>
            <div className="space-y-2">
              {(role === 'service' || role === 'admin') && (
                <>
                  <button onClick={() => navigate(`/service/case/${id}`)} className="w-full btn-primary text-sm flex items-center justify-center gap-2"><FiTool /> Diagnosis & Service View</button>
                  <button onClick={() => navigate(`/part-requests/new?caseId=${id}`)} className="w-full btn-secondary text-sm flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 border-0 text-white"><FiPlusCircle /> Raise Part Request</button>
                  <button onClick={handleEdit} className="w-full btn-secondary text-sm flex items-center justify-center gap-2"><FiSmartphone /> Update Mobile / Details</button>
                </>
              )}
              <button onClick={handlePrintReceipt} className="w-full btn-secondary text-sm flex items-center justify-center gap-2"><FiPrinter /> Print Receipt</button>
              <button onClick={handlePrintJobReport} className="w-full btn-secondary text-sm flex items-center justify-center gap-2"><FiFileText /> Print Job Report</button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Note Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Add Job Note</h3>
            <textarea rows={4} className="input-field mb-4" placeholder="Enter note..." value={newNote} onChange={e => setNewNote(e.target.value)} />
            <div className="flex gap-3"><button onClick={handleAddNote} className="btn-primary flex-1">Add</button><button onClick={() => setShowNotesModal(false)} className="btn-secondary flex-1">Cancel</button></div>
          </div>
        </div>
      )}

      {/* Send Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <FiSend className="text-green-500" /> Send Message to Customer
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Advisor: <span className="font-semibold text-blue-600">{user?.name || user?.email?.split('@')[0] || 'Advisor'}</span>
                  <span className="mx-2">|</span>
                  Role: <span className="capitalize text-gray-500">{role}</span>
                </p>
              </div>
              <button onClick={() => setShowMessageModal(false)} className="text-gray-500 hover:text-gray-700"><FiX size={24} /></button>
            </div>

            <div className="bg-gray-100 rounded-xl p-3 mb-4 flex flex-wrap gap-4 text-sm">
              <div><span className="text-gray-500">To:</span> <span className="font-semibold text-gray-800">{caseData.customerName}</span></div>
              <div><span className="text-gray-500">Mobile:</span> <span className="text-gray-800">{caseData.mobileNumber || 'ΓÇö'}</span></div>
              <div><span className="text-gray-500">Email:</span> <span className="text-gray-800">{caseData.email || 'ΓÇö'}</span></div>
              <div><span className="text-gray-500">Job ID:</span> <span className="font-mono text-blue-600">{caseData.jobId}</span></div>
            </div>

            {((selectedChannel !== 'email' && serverMockMode.sms) || (selectedChannel === 'email' && serverMockMode.email)) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
                <p className="font-semibold">ΓÜá∩╕Å {selectedChannel === 'email' ? 'Email' : 'SMS/WhatsApp'} is in MOCK / TEST mode</p>
                <p className="text-xs mt-1">Messages are NOT actually delivered. To send real messages, add your {selectedChannel === 'email' ? 'SMTP' : 'Twilio'} credentials to <code className="bg-yellow-100 px-1 rounded">wobble-crm/server/.env</code> and restart the server.</p>
              </div>
            )}

            <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">1. Select Message Channel</label>
                  <select
                    className="input-field"
                    value={selectedChannel}
                    onChange={(e) => {
                      setSelectedChannel(e.target.value);
                      setSelectedTemplate('greeting');
                      setMessageMode('template');
                      setCustomMessage('');
                    }}
                  >
                    <option value="whatsapp">WhatsApp Message</option>
                    <option value="sms">SMS / Text Message</option>
                    <option value="email">Email Message</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    You can send the same message to WhatsApp, SMS, or Email.
                  </p>
                </div>


              <div>
                <label className="block text-gray-700 mb-2 font-medium">2. Message Type</label>
                <div className="flex gap-2">
                  <button onClick={() => { setMessageMode('template'); setSelectedTemplate('greeting'); }} className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${messageMode === 'template' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}>Use Template</button>
                  <button onClick={() => { setMessageMode('manual'); setSelectedTemplate('custom'); }} className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${messageMode === 'manual' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}>Type Manually</button>
                </div>
              </div>

              {messageMode === 'template' && (
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">3. Choose Template</label>
                  <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} className="input-field">
                    {Object.keys(messageTemplates[selectedChannel]).map((key) => (
                      <option key={key} value={key}>{templateLabels[key] || key}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-gray-700 mb-2 font-medium">{messageMode === 'template' ? '4. Preview Message' : '3. Type Your Message'}</label>
                <textarea rows={6} className="input-field" value={getPreviewMessage()} onChange={(e) => { if (messageMode === 'manual' || selectedTemplate === 'custom') { setCustomMessage(e.target.value); } }} readOnly={messageMode === 'template' && selectedTemplate !== 'custom'} placeholder={messageMode === 'manual' ? 'Type your message here...' : ''} />
                {messageMode === 'template' && selectedTemplate !== 'custom' && (
                  <p className="text-xs text-gray-400 mt-1">Select "Type Manually" or "Custom Message" template to edit freely.</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSendMessage} disabled={sending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {sending ? 'Sending...' : <><FiSend /> Send {selectedChannel === 'whatsapp' ? 'WhatsApp' : selectedChannel === 'sms' ? 'SMS' : 'Email'}</>}
                </button>
                <button onClick={() => setShowMessageModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

