import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { FiUpload, FiPlusSquare, FiFileText, FiShoppingCart } from 'react-icons/fi';


const normalizeKey = (value) => (value || '').toString().trim().toLowerCase();

export default function WarehouseInventory() {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('manual');
  const [uploadFile, setUploadFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [manualForm, setManualForm] = useState({
    partName: '',
    variant: '',
    partQuantity: '',
    dispatchQuantity: '',
    remainingQuantity: '',
    notes: '',
  });
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestForm, setRequestForm] = useState({
    partName: '',
    variant: '',
    quantity: 1,
    reason: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const inventorySnap = await getDocs(collection(db, 'inventory'));
      const inventory = inventorySnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setInventoryItems(inventory);
      const requestsSnap = await getDocs(query(collection(db, 'partRequests'), where('status', '==', 'Pending Approval')));
      setPendingRequests(requestsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleManualChange = (field, value) => {
    setManualForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRequestChange = (field, value) => {
    setRequestForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveManualInventory = async () => {
    if (!manualForm.partName.trim()) {
      toast.error('Part name is required');
      return;
    }

    const partQuantity = Number(manualForm.partQuantity) || 0;
    const dispatchQuantity = Number(manualForm.dispatchQuantity) || 0;
    const remainingQuantity = Number(manualForm.remainingQuantity) || Math.max(partQuantity - dispatchQuantity, 0);

    if (partQuantity < 0 || dispatchQuantity < 0 || remainingQuantity < 0) {
      toast.error('Quantities must be zero or positive');
      return;
    }

    setProcessing(true);
    try {
      const partName = manualForm.partName.trim();
      const variant = manualForm.variant.trim();
      const inventoryKey = `${normalizeKey(partName)}|${normalizeKey(variant)}`;
      const inventoryQuery = query(collection(db, 'inventory'), where('inventoryKey', '==', inventoryKey));
      const snapshot = await getDocs(inventoryQuery);
      const payload = {
        partName,
        variant,
        partQuantity,
        dispatchQuantity,
        remainingQuantity,
        notes: manualForm.notes.trim(),
        inventoryKey,
        updatedAt: new Date().toISOString(),
      };

      if (!snapshot.empty) {
        const itemDoc = snapshot.docs[0];
        await updateDoc(doc(db, 'inventory', itemDoc.id), payload);
        toast.success('Inventory updated');
      } else {
        await addDoc(collection(db, 'inventory'), payload);
        toast.success('Inventory item added');
      }

      setManualForm({ partName: '', variant: '', partQuantity: '', dispatchQuantity: '', remainingQuantity: '', notes: '' });
      setModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save inventory');
    } finally {
      setProcessing(false);
    }
  };

  const parseUpload = async () => {
    if (!uploadFile) {
      toast.error('Select an Excel file first');
      return;
    }

    setProcessing(true);
    try {
      const data = await uploadFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      let imported = 0;

      for (const row of rows) {
        const rowKeys = Object.keys(row);
        const normalized = {};
        rowKeys.forEach((key) => {
          normalized[normalizeKey(key)] = row[key];
        });

        const partName = normalized['part name'] || normalized['partname'] || normalized['part'] || ''; 
        if (!partName) {
          continue;
        }

        const variant = normalized['variant'] || normalized['model'] || '';
        const partQuantity = Number(normalized['part quantity'] || normalized['quantity'] || normalized['stock'] || 0);
        const dispatchQuantity = Number(normalized['dispatch quantity'] || normalized['despatch quantity'] || normalized['dispatch'] || normalized['despatch'] || 0);
        const remainingQuantity = Number(normalized['remaining quantity'] || normalized['remaining'] || Math.max(partQuantity - dispatchQuantity, 0));
        const pendingQuantity = Number(normalized['pending quantity'] || normalized['pending'] || 0);

        const inventoryKey = `${normalizeKey(partName)}|${normalizeKey(variant)}`;
        const payload = {
          partName: partName.toString().trim(),
          variant: variant.toString().trim(),
          partQuantity,
          dispatchQuantity,
          remainingQuantity,
          pendingQuantity,
          inventoryKey,
          updatedAt: new Date().toISOString(),
        };

        const inventoryQuery = query(collection(db, 'inventory'), where('inventoryKey', '==', inventoryKey));
        const snapshot = await getDocs(inventoryQuery);
        if (!snapshot.empty) {
          const itemDoc = snapshot.docs[0];
          await updateDoc(doc(db, 'inventory', itemDoc.id), payload);
        } else {
          await addDoc(collection(db, 'inventory'), payload);
        }
        imported += 1;
      }

      if (imported === 0) {
        toast.error('No valid inventory rows found');
      } else {
        toast.success(`${imported} inventory rows processed`);
      }

      setUploadFile(null);
      setModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Upload failed');
    } finally {
      setProcessing(false);
    }
  };

  const openRequestModal = (item) => {
    setRequestForm({
      partName: item.partName,
      variant: item.variant,
      quantity: 1,
      reason: '',
    });
    setRequestModalOpen(true);
  };

  const submitRequest = async () => {
    if (!requestForm.partName.trim() || Number(requestForm.quantity) <= 0) {
      toast.error('Part name and quantity are required');
      return;
    }

    setRequestLoading(true);
    try {
      await addDoc(collection(db, 'partRequests'), {
        partName: requestForm.partName.trim(),
        variant: requestForm.variant.trim(),
        quantity: Number(requestForm.quantity),
        issueDescription: requestForm.reason.trim(),
        status: 'Pending Approval',
        requestedAt: new Date().toISOString(),
        source: 'warehouseInventory',
        jobId: 'Inventory Request',
        customerName: 'Warehouse Inventory',
      });
      toast.success('Inventory request sent to manager');
      setRequestModalOpen(false);
      setRequestForm({ partName: '', variant: '', quantity: 1, reason: '' });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to send request');
    } finally {
      setRequestLoading(false);
    }
  };

  const totals = inventoryItems.reduce(
    (acc, item) => ({
      totalQty: acc.totalQty + (Number(item.partQuantity) || 0),
      dispatchedQty: acc.dispatchedQty + (Number(item.dispatchQuantity) || 0),
      availableQty: acc.availableQty + (Number(item.remainingQuantity) || 0),
      pendingQty: acc.pendingQty + (Number(item.pendingQuantity) || 0),
    }),
    { totalQty: 0, dispatchedQty: 0, availableQty: 0, pendingQty: 0 }
  );

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Inventory & Stock</h2>
        <p className="text-gray-500 mt-1">Manage warehouse stock details, upload stock files, and request parts from manager.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="card text-center">
          <p className="text-sm text-gray-500">Total SKUs</p>
          <p className="text-3xl font-bold text-slate-900">{inventoryItems.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500">Total Stock</p>
          <p className="text-3xl font-bold text-slate-900">{totals.totalQty}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500">Dispatched</p>
          <p className="text-3xl font-bold text-slate-900">{totals.dispatchedQty}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500">Available</p>
          <p className="text-3xl font-bold text-slate-900">{totals.availableQty}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Pending inventory requests are shown below and will be reviewed by manager/admin.</p>
          <p className="text-sm"><span className="font-semibold">Pending requests:</span> {pendingRequests.length}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => { setModalMode('manual'); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><FiPlusSquare /> Update Stock</button>
          <button onClick={() => { setModalMode('upload'); setModalOpen(true); }} className="btn-secondary flex items-center gap-2"><FiUpload /> Upload Excel</button>
          <button onClick={() => setRequestModalOpen(true)} className="btn-secondary flex items-center gap-2"><FiShoppingCart /> Request Part</button>
        </div>
      </div>

      <div className="overflow-x-auto card">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Part Name</th>
              <th>Variant</th>
              <th>Total Qty</th>
              <th>Dispatched</th>
              <th>Remaining</th>
              <th>Pending</th>
              <th>Last Updated</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {inventoryItems.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-500">No inventory items found. Add stock manually or upload a file.</td></tr>
            ) : (
              inventoryItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.partName}</td>
                  <td>{item.variant || 'Standard'}</td>
                  <td>{item.partQuantity ?? 0}</td>
                  <td>{item.dispatchQuantity ?? 0}</td>
                  <td>{item.remainingQuantity ?? 0}</td>
                  <td>{item.pendingQuantity ?? 0}</td>
                  <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}</td>
                  <td className="text-right">
                    <button onClick={() => openRequestModal(item)} className="btn-secondary text-sm">Request</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-100 rounded-3xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <div>
                <h3 className="text-2xl font-semibold">{modalMode === 'manual' ? 'Update Stock Manually' : 'Upload Stock File'}</h3>
                <p className="text-sm text-gray-500">Use manual update for one item, or upload Excel to refresh many items at once.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="btn-secondary">Close</button>
            </div>
            <div className="flex gap-3 mb-5">
              <button onClick={() => setModalMode('manual')} className={`py-2 px-4 rounded-xl ${modalMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>Manual</button>
              <button onClick={() => setModalMode('upload')} className={`py-2 px-4 rounded-xl ${modalMode === 'upload' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>Excel Upload</button>
            </div>
            {modalMode === 'manual' ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Part Name</label>
                    <input value={manualForm.partName} onChange={(e) => handleManualChange('partName', e.target.value)} className="input-field" placeholder="Display" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Variant</label>
                    <input value={manualForm.variant} onChange={(e) => handleManualChange('variant', e.target.value)} className="input-field" placeholder="6GB + 128GB" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Part Quantity</label>
                    <input type="number" min="0" value={manualForm.partQuantity} onChange={(e) => handleManualChange('partQuantity', e.target.value)} className="input-field" placeholder="58" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Dispatch Quantity</label>
                    <input type="number" min="0" value={manualForm.dispatchQuantity} onChange={(e) => handleManualChange('dispatchQuantity', e.target.value)} className="input-field" placeholder="1" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Remaining Quantity</label>
                    <input type="number" min="0" value={manualForm.remainingQuantity} onChange={(e) => handleManualChange('remainingQuantity', e.target.value)} className="input-field" placeholder="57" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Notes</label>
                  <textarea value={manualForm.notes} onChange={(e) => handleManualChange('notes', e.target.value)} rows={3} className="input-field" placeholder="Optional notes about stock" />
                </div>
                <button onClick={saveManualInventory} disabled={processing} className="btn-primary w-full flex items-center justify-center gap-2"><FiPlusSquare /> {processing ? 'Saving...' : 'Save Stock'}</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Excel File</label>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="w-full" />
                </div>
                <div className="text-sm text-gray-500">
                  Expected columns: <strong>Part Name</strong>, <strong>Variant</strong>, <strong>Part Quantity</strong>, <strong>Dispatch Quantity</strong>, <strong>Remaining Quantity</strong>.
                </div>
                <button onClick={parseUpload} disabled={processing} className="btn-primary w-full flex items-center justify-center gap-2"><FiUpload /> {processing ? 'Uploading...' : 'Import Stock'}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {requestModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-100 rounded-3xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-2xl font-semibold">Request Inventory Part</h3>
                <p className="text-sm text-gray-500">Send this part request to manager/admin for approval.</p>
              </div>
              <button onClick={() => setRequestModalOpen(false)} className="btn-secondary">Close</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Part Name</label>
                <input value={requestForm.partName} onChange={(e) => handleRequestChange('partName', e.target.value)} className="input-field" placeholder="Display" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Variant</label>
                <input value={requestForm.variant} onChange={(e) => handleRequestChange('variant', e.target.value)} className="input-field" placeholder="8GB + 128GB" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Request Quantity</label>
                  <input type="number" min="1" value={requestForm.quantity} onChange={(e) => handleRequestChange('quantity', e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Reason</label>
                  <input value={requestForm.reason} onChange={(e) => handleRequestChange('reason', e.target.value)} className="input-field" placeholder="Low stock / urgent dispatch" />
                </div>
              </div>
              <button onClick={submitRequest} disabled={requestLoading} className="btn-primary w-full flex items-center justify-center gap-2"><FiFileText /> {requestLoading ? 'Requesting...' : 'Send Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
