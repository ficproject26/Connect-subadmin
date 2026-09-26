import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Store, MapPin, User, Phone, Layers, Building2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolvePincodeHierarchy } from '../utils/pincodeDirectory';

export function InitiateVendorOnboardingModal({ isOpen, onClose, onSuccess, defaultPincode = '' }) {
  const { user } = useAuth();

  const isPincodeLocked = Boolean(
    user?.pincode && 
    (user.role?.toLowerCase().includes('pincode') || user.role?.toLowerCase().includes('agent'))
  );

  const initialPin = defaultPincode || user?.pincode || '';
  const initialResolved = resolvePincodeHierarchy(initialPin);

  const [formData, setFormData] = useState({
    vendorName: '',
    category: 'Services',
    contactPerson: '',
    phone: '',
    address: '',
    pincode: initialPin,
    division: initialResolved.division || user?.division || '',
    district: initialResolved.district || user?.district || '',
    state: initialResolved.state || user?.state || 'Tamil Nadu',
    notes: 'Ground vendor onboarding initiated by Field Agent'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const pin = defaultPincode || user?.pincode || formData.pincode;
    if (pin) {
      const resolved = resolvePincodeHierarchy(pin);
      setFormData(prev => ({
        ...prev,
        pincode: pin,
        division: resolved.division || prev.division || user?.division || '',
        district: resolved.district || prev.district || user?.district || '',
        state: resolved.state || prev.state || user?.state || 'Tamil Nadu'
      }));
    }
  }, [defaultPincode, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'pincode') {
      const pinOnly = value.replace(/\D/g, '').slice(0, 6);
      const resolved = resolvePincodeHierarchy(pinOnly);
      setFormData(prev => ({
        ...prev,
        pincode: pinOnly,
        division: resolved.division || prev.division || user?.division || '',
        district: resolved.district || prev.district || user?.district || '',
        state: resolved.state || prev.state || user?.state || 'Tamil Nadu'
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vendorName.trim()) {
      setError('Vendor business name is required');
      return;
    }
    if (!formData.pincode.trim() || formData.pincode.length !== 6) {
      setError('A valid 6-digit operating pincode is required');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      if (onSuccess) {
        await onSuccess({
          ...formData,
          addedBy: {
            id: user?._id || user?.id || 'agent',
            name: user?.name || 'Local Agent',
            role: user?.role || 'Pincode Agent',
            pincode: formData.pincode,
            division: formData.division,
            district: formData.district,
            state: formData.state
          }
        });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit onboarding');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Initiate Vendor Onboarding (Ground Agent)" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Info banner explaining the activity flow */}
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200">
          <div className="font-bold flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Agent Activity Flow: Pincode Agent ➔ Divisional Agent ➔ District Agent ➔ State Agent
          </div>
          <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
            Submitting this onboarding creates an active activity record under your assigned territory and escalates it to the Divisional Agent for cluster verification.
          </p>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Vendor Business Name *
            </label>
            <input
              type="text"
              name="vendorName"
              placeholder="e.g. Balaji Hardware & Electricals"
              value={formData.vendorName}
              onChange={handleChange}
              required
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Vendor Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="Services">Services (Repairs / Trades)</option>
                <option value="Food">Food (Restaurants / Cafes)</option>
                <option value="Daily Needs">Daily Needs (Groceries / FMCG)</option>
                <option value="Stay">Stay (Hotels / Lodging)</option>
                <option value="Travel">Travel & Transportation</option>
                <option value="Product">Retail Products & Goods</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Person Name
              </label>
              <input
                type="text"
                name="contactPerson"
                placeholder="Merchant Owner / Manager"
                value={formData.contactPerson}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Merchant Phone Number
              </label>
              <input
                type="text"
                name="phone"
                placeholder="+91 94431 10000"
                value={formData.phone}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Operating Pincode {isPincodeLocked ? '(Locked to your Territory)' : '*'}
              </label>
              <input
                type="text"
                name="pincode"
                maxLength={6}
                value={formData.pincode}
                onChange={handleChange}
                readOnly={isPincodeLocked}
                placeholder="6-digit PIN"
                className={`w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold ${
                  isPincodeLocked ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px]">Division:</span>
              <div className="font-bold text-slate-900 dark:text-white truncate">{formData.division || '-'}</div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px]">District:</span>
              <div className="font-bold text-slate-900 dark:text-white truncate">{formData.district || '-'}</div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px]">State:</span>
              <div className="font-bold text-slate-900 dark:text-white truncate">{formData.state || '-'}</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Shop / Commercial Address
            </label>
            <textarea
              name="address"
              rows={2}
              placeholder="Commercial unit number, street, landmark..."
              value={formData.address}
              onChange={handleChange}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit to Divisional Agent'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
