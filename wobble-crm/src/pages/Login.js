import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  FiUser, FiPhone, FiPackage, FiShield, FiTrendingUp, 
  FiMail, FiLock, FiLogIn 
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import BrandLogo, { BrandIcon } from '../components/BrandLogo';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'callcenter'
  });
  const [loading, setLoading] = useState(false);

  const roleCredentials = {
    callcenter: { email: 'callcenter@wobble.com', password: '654321', label: 'Call Center', icon: FiUser, color: 'from-blue-500 to-blue-600' },
    service: { email: 'service@wobble.com', password: '654321', label: 'Service Center', icon: FiPhone, color: 'from-green-500 to-green-600' },
    warehouse: { email: 'warehouse@wobble.com', password: '654321', label: 'Warehouse', icon: FiPackage, color: 'from-yellow-500 to-yellow-600' },
    manager: { email: 'manager@wobble.com', password: '654321', label: 'Manager', icon: FiShield, color: 'from-cyan-500 to-blue-600' },
    tl: { email: 'tl@wobble.com', password: '654321', label: 'Team Lead', icon: FiUser, color: 'from-slate-500 to-slate-700' },
    admin: { email: 'admin@wobble.com', password: '654321', label: 'Admin', icon: FiShield, color: 'from-red-500 to-red-600' },
    sales: { email: 'sales@wobble.com', password: '654321', label: 'Sales Team', icon: FiTrendingUp, color: 'from-purple-500 to-purple-600' }
  };

  const handleRoleSelect = (roleKey) => {
    setFormData({
      ...formData,
      role: roleKey,
      email: roleCredentials[roleKey].email,
      password: roleCredentials[roleKey].password
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error('Email and password are required');
      return;
    }
    setLoading(true);
    try {
      const result = await login(formData.email, formData.password);
      if (result.success) {
        toast.success(`Welcome ${roleCredentials[formData.role].label}!`);
        navigate('/dashboard');
      } else {
        toast.error(result.error || 'Invalid credentials!');
      }
    } catch (error) {
      console.error('Login submit error:', error);
      toast.error(error?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentRole = roleCredentials[formData.role];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <BrandLogo className="w-72 h-auto mx-auto drop-shadow-xl" />
          <p className="text-gray-500 mt-2 text-lg">Complete Service Management Platform</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Role cards */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Select your role</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(roleCredentials).map(([key, config]) => {
                const Icon = config.icon;
                const isSelected = formData.role === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleRoleSelect(key)}
                    className={`p-5 rounded-2xl text-left transition-all duration-200 border-2 ${
                      isSelected
                        ? `bg-gradient-to-br ${config.color} border-transparent shadow-lg scale-[1.02]`
                        : 'bg-white border-gray-200 hover:border-blue-300 shadow-sm'
                    }`}
                  >
                    <Icon className={`text-3xl mb-2 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                    <p className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-700'}`}>{config.label}</p>
                    <p className={`text-xs mt-1 ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>Click to select</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Login form */}
          <div className="bg-white backdrop-blur-md rounded-3xl p-8 border border-gray-200 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-24 h-24 mx-auto rounded-3xl shadow-xl overflow-hidden bg-white p-3">
                <BrandIcon className="w-full h-full" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mt-4">Login to your account</h2>
              <p className="text-gray-500 text-sm mt-1">as {currentRole.label}</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-400" required />
              </div>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input type="password" placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-400" required />
              </div>
              <button type="submit" disabled={loading} className={`w-full py-3 rounded-xl text-white font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2 ${loading ? 'bg-gray-600 cursor-not-allowed' : `bg-gradient-to-r ${currentRole.color} hover:opacity-90 hover:scale-[1.02]`}`}>
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div> : <><FiLogIn size={20} /> Login as {currentRole.label}</>}
              </button>
            </form>
            <p className="text-center text-gray-500 text-xs mt-6">Firebase auth is active. Use your Firebase email/password to log in.</p>
            <p className="text-center text-amber-600 text-xs mt-2 font-semibold">Default password: 654321</p>
          </div>
        </div>
      </div>
    </div>
  );
}