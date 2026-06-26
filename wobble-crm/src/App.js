import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout-fixed';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CaseRegister from './pages/CaseRegister';
import SearchCase from './pages/SearchCase';
import CaseDetails from './pages/CaseDetails';
import ServiceCaseDetail from './pages/ServiceCaseDetail';
import PartRequestForm from './pages/PartRequestForm';
import PartRequestApproval from './pages/PartRequestApproval';
import WarehouseDispatch from './pages/WarehouseDispatch';
import WarehouseInventory from './pages/WarehouseInventory';
import Reports from './pages/Reports';
import AdminDashboard from './pages/AdminDashboard';
import SalesActivation from './pages/SalesActivation';
import SalesDashboard from './pages/SalesDashboard';
import BulkUpload from './pages/BulkUpload';
import CallCenterActivationSearch from './pages/CallCenterActivationSearch';
import ActivationSearch from './pages/ActivationSearch';
import WarrantyRequest from './pages/WarrantyRequest';
import WarrantyActivation from './pages/WarrantyActivation';
import CallCenterWarranty from './pages/CallCenterWarranty';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/cases/search" element={<ProtectedRoute><Layout><SearchCase /></Layout></ProtectedRoute>} />
          <Route path="/case/:id" element={<ProtectedRoute><Layout><CaseDetails /></Layout></ProtectedRoute>} />
          <Route path="/cases/register" element={<ProtectedRoute allowedRoles={['callcenter','service','admin']}><Layout><CaseRegister /></Layout></ProtectedRoute>} />
          <Route path="/service/case/:id" element={<ProtectedRoute allowedRoles={['service','admin']}><Layout><ServiceCaseDetail /></Layout></ProtectedRoute>} />
          <Route path="/part-requests/new" element={<ProtectedRoute allowedRoles={['service','admin']}><Layout><PartRequestForm /></Layout></ProtectedRoute>} />
          <Route path="/admin/approvals" element={<ProtectedRoute allowedRoles={['admin','manager']}><Layout><PartRequestApproval /></Layout></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><Layout><AdminDashboard /></Layout></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin','manager','tl']}><Layout><Reports /></Layout></ProtectedRoute>} />

          {/* Warehouse */}
          <Route path="/warehouse/inventory" element={<ProtectedRoute allowedRoles={['warehouse', 'admin']}><Layout><WarehouseInventory /></Layout></ProtectedRoute>} />
          <Route path="/warehouse/dispatch" element={<ProtectedRoute allowedRoles={['warehouse', 'admin']}><Layout><WarehouseDispatch /></Layout></ProtectedRoute>} />

          {/* Sales */}
          <Route path="/sales/activation" element={<ProtectedRoute allowedRoles={['sales', 'admin']}><Layout><SalesActivation /></Layout></ProtectedRoute>} />

          {/* Call Center */}
          <Route path="/callcenter/warranty" element={<ProtectedRoute allowedRoles={['callcenter', 'admin']}><Layout><CallCenterWarranty /></Layout></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
          <Route path="/sales/activate" element={<ProtectedRoute allowedRoles={['admin','sales']}><Layout><SalesActivation /></Layout></ProtectedRoute>} />
          <Route path="/sales/bulk-upload" element={<ProtectedRoute allowedRoles={['admin','sales']}><Layout><BulkUpload /></Layout></ProtectedRoute>} />
          <Route path="/activation/search" element={<ProtectedRoute allowedRoles={['callcenter','admin']}><Layout><CallCenterActivationSearch /></Layout></ProtectedRoute>} />
          <Route path="/warranty/request" element={<ProtectedRoute allowedRoles={['callcenter','admin']}><Layout><WarrantyRequest /></Layout></ProtectedRoute>} />
          <Route path="/warranty/activate" element={<ProtectedRoute allowedRoles={['admin']}><Layout><WarrantyActivation /></Layout></ProtectedRoute>} />
          <Route path="/sales/dashboard" element={<ProtectedRoute allowedRoles={['admin','sales']}><Layout><SalesDashboard /></Layout></ProtectedRoute>} />
          <Route path="/sales/search" element={<ProtectedRoute allowedRoles={['admin','sales']}><Layout><ActivationSearch /></Layout></ProtectedRoute>} />
          <Route path="/admin/bulk-upload" element={<ProtectedRoute allowedRoles={['admin']}><Layout><BulkUpload /></Layout></ProtectedRoute>} />
          <Route path="/admin/centers" element={<ProtectedRoute allowedRoles={['admin']}><Navigate to="/admin/dashboard" /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;