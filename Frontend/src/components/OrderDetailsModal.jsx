import React from 'react';
import { Modal } from './Modal';
import { StatusBadge, CardTierIcon } from './Badge';
import { useTheme } from '../context/ThemeContext';
import {
  Package,
  Calendar,
  CreditCard,
  MapPin,
  Clock,
  CheckCircle2,
  CircleDot,
  Circle,
  XCircle,
  RotateCcw,
  IndianRupee,
  ShoppingBag,
  ShieldCheck,
  User,
  Truck,
  Store
} from 'lucide-react';

const STANDARD_STEPS = [
  { status: 'Order Placed', desc: 'Customer placed order through catalog' },
  { status: 'Confirmed', desc: 'Payment verified & order confirmed by admin' },
  { status: 'Packed', desc: 'Order packed in secure parcel with invoice' },
  { status: 'Shipped', desc: 'Handed over to state logistics carrier' },
  { status: 'Out for Delivery', desc: 'Assigned courier out for doorstep delivery' },
  { status: 'Delivered', desc: 'Successfully delivered to customer' }
];

const RETURN_STEPS = [
  { status: 'Return Requested', desc: 'Customer requested return of product items' },
  { status: 'Return Approved', desc: 'Return request inspected & approved by admin' },
  { status: 'Returned', desc: 'Items retrieved & returned to warehouse inventory' }
];

export function OrderDetailsModal({ order, isOpen, onClose }) {
  const { isDark } = useTheme();

  if (!order) return null;

  const statusLower = (order.status || '').toLowerCase().trim();
  const isCancelled = statusLower === 'cancelled';
  const isReturnFlow = ['return requested', 'return approved', 'returned'].includes(statusLower);

  // Generate real database-driven timeline events
  const buildTimeline = () => {
    // If order already has a rich timeline array from backend delivery_status_history
    const dbTimeline = Array.isArray(order.timeline) ? order.timeline : [];

    // Helper to find real timestamp from database delivery_status_history
    const findHistoryEvent = (stepStatus) => {
      const s = stepStatus.toLowerCase();
      return dbTimeline.find(h => {
        const hStatus = (h.status || '').toLowerCase();
        if (s === 'order placed') return hStatus === 'order placed' || hStatus === 'order received';
        if (s === 'confirmed') return hStatus === 'confirmed';
        if (s === 'packed') return hStatus === 'packed';
        if (s === 'shipped') return hStatus === 'shipped';
        if (s === 'out for delivery') return hStatus === 'out for delivery';
        if (s === 'delivered') return hStatus === 'delivered';
        return hStatus === s;
      });
    };

    if (isCancelled) {
      const cancelHist = dbTimeline.find(h => (h.status || '').toLowerCase().includes('cancel'));
      return [
        {
          status: 'Order Placed',
          time: order.orderDate || 'Not provided',
          desc: 'Order received into state ledger',
          state: 'completed'
        },
        {
          status: 'Cancelled',
          time: cancelHist ? (cancelHist.time || cancelHist.timestamp) : 'Not provided',
          desc: cancelHist?.desc || 'Order cancelled by customer or vendor',
          state: 'cancelled'
        }
      ];
    }

    // Determine current step index in standard flow based on ACTUAL database order.status
    const stepOrder = ['order placed', 'confirmed', 'packed', 'shipped', 'out for delivery', 'delivered'];
    let currentIndex = 0;
    if (statusLower === 'order received' || statusLower === 'order placed') {
      currentIndex = 0;
    } else if (statusLower === 'confirmed') {
      currentIndex = 1;
    } else if (statusLower === 'packed') {
      currentIndex = 2;
    } else if (statusLower === 'shipped') {
      currentIndex = 3;
    } else if (statusLower === 'out for delivery') {
      currentIndex = 4;
    } else if (statusLower === 'delivered') {
      currentIndex = 5;
    } else if (isReturnFlow) {
      currentIndex = 5; // Return flow happens after delivery
    }

    const events = STANDARD_STEPS.map((step, idx) => {
      let state = 'upcoming';
      const hist = findHistoryEvent(step.status);

      if (idx < currentIndex) {
        state = 'completed';
      } else if (idx === currentIndex) {
        // If current step is Order Placed / Order Received, it has already been received/completed
        state = (idx === 0) ? 'completed' : 'current';
      }

      // Real timestamp: only use actual history event timestamp or order creation date for step 0
      let time = null;
      if (hist && hist.time) {
        time = hist.time;
      } else if (idx === 0) {
        time = order.orderDate || (order.created_at ? new Date(order.created_at).toLocaleString('en-IN') : null);
      } else if (idx <= currentIndex && hist) {
        time = hist.time;
      }

      return {
        status: step.status,
        desc: hist?.desc || step.desc,
        time,
        state
      };
    });

    // If return flow, append return lifecycle
    if (isReturnFlow) {
      const returnOrder = ['return requested', 'return approved', 'returned'];
      const currentReturnIdx = returnOrder.indexOf(statusLower);

      RETURN_STEPS.forEach((step, rIdx) => {
        let state = 'upcoming';
        const hist = findHistoryEvent(step.status);
        if (rIdx < currentReturnIdx) state = 'completed';
        else if (rIdx === currentReturnIdx) state = 'current';

        events.push({
          status: step.status,
          desc: hist?.desc || step.desc,
          time: hist ? hist.time : null,
          state,
          isReturn: true
        });
      });
    }

    return events;
  };

  const timelineEvents = buildTimeline();

  const isCardMember = order.membershipTier && 
    !['normal', 'standard', 'customer', 'none'].includes(String(order.membershipTier).toLowerCase());
  const normalizedTier = isCardMember ? 
    (order.membershipTier.charAt(0).toUpperCase() + order.membershipTier.slice(1).toLowerCase()) : null;

  // Real vendor details from database
  const vendorName = order.vendorBusinessName || order.vendorName || 'Not provided';
  const vendorId = order.vendorId && order.vendorId !== '-' ? order.vendorId : 'Not provided';
  const vendorCategory = order.vendorCategory && order.vendorCategory !== '-' ? order.vendorCategory : 'Not provided';
  const vendorContact = order.vendorContact && order.vendorContact !== '-' ? order.vendorContact : (order.vendorPhone || 'Not provided');
  const vendorPhone = order.vendorPhone && order.vendorPhone !== '-' ? order.vendorPhone : 'Not provided';
  const vendorEmail = order.vendorEmail && order.vendorEmail !== '-' ? order.vendorEmail : 'Not provided';
  const vendorLocation = order.vendorLocation && order.vendorLocation !== '-' ? order.vendorLocation : (order.district ? `${order.district}${order.division ? `, ${order.division}` : ''}` : 'Not provided');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
            {order.orderNumber}
          </span>
          <StatusBadge status={order.status} />
        </div>
      }
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Top Summary Card - 3-way layout for Customer, Vendor, and Delivery */}
        <div className={`p-4 rounded-xl border ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/70 border-slate-200'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
            {/* Left: Customer Details */}
            <div className="md:pr-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-muted dark:text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-navy dark:text-blue-400" />
                  Customer Details
                </span>
                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                  ID: {order.customerId || 'Not provided'}
                </span>
              </div>

              <div>
                <div className="font-bold text-sm text-navy dark:text-white">
                  {order.customerName || 'Customer'}
                </div>
                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                  Phone: {order.customerPhone && order.customerPhone !== '-' ? order.customerPhone : 'Not provided'}
                </div>
                {order.customerEmail && order.customerEmail !== 'Not provided' && order.customerEmail !== '-' && (
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    Email: {order.customerEmail}
                  </div>
                )}
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span>{order.district ? `${order.district}${order.division ? `, ${order.division}` : ''}` : (order.state || 'Tamil Nadu')}</span>
                  {order.pincode && (
                    <>
                      <span>•</span>
                      <span className="font-mono">PIN: {order.pincode}</span>
                    </>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2 mt-0.5" title={order.customerAddress}>
                  {order.customerAddress || 'Not provided'}
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Order Date: <span className="font-medium text-navy-secondary dark:text-slate-200">{order.orderDate || 'Not provided'}</span></span>
              </div>
            </div>

            {/* Right: Vendor Details */}
            <div className="pt-4 md:pt-0 md:pl-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-muted dark:text-slate-400 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-navy dark:text-blue-400" />
                  Vendor Details
                </span>
                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[150px]" title={vendorId}>
                  ID: {vendorId}
                </span>
              </div>

              <div>
                <div className="font-bold text-sm text-navy dark:text-white">
                  {vendorName}
                </div>
                {vendorCategory && vendorCategory !== 'Not provided' && (
                  <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    Category: {vendorCategory}
                  </div>
                )}
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>{vendorLocation}</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>Contact: <span className="font-medium text-navy-secondary dark:text-slate-200">{vendorContact}</span></span>
                </div>
                {vendorEmail !== 'Not provided' && (
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    Email: {vendorEmail}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delivery Details Row */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivery Partner</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{order.deliveryPartnerName || 'Not assigned'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Partner Contact</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{order.deliveryPartnerPhone || 'Not provided'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivery Status</span>
              <span className="font-semibold text-blue-600 dark:text-indigo-400">{order.deliveryStatus || order.status}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Date</span>
              <span className="text-slate-800 dark:text-slate-200">{order.deliveryAssignedAt || 'Pending assignment'}</span>
            </div>
          </div>
        </div>

        {/* Order Status Timeline Stepper */}
        <div className={`p-4 sm:p-5 rounded-2xl border ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
        } shadow-sm`}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Order Status Flow & Detailed Timeline
            </h4>
            <span className="text-[11px] text-slate-400">
              Current: <strong className="text-slate-700 dark:text-slate-200">{order.status}</strong>
            </span>
          </div>

          {/* Stepper Timeline */}
          <div className="space-y-0">
            {timelineEvents.map((evt, idx) => {
              const isDone = evt.state === 'completed';
              const isCurrent = evt.state === 'current';
              const isCancel = evt.state === 'cancelled';
              const isReturn = evt.isReturn;
              const isLast = idx === timelineEvents.length - 1;

              // Connect completed line if current or completed
              const nextEvt = timelineEvents[idx + 1];
              const isLineCompleted = isDone && (nextEvt?.state === 'completed' || nextEvt?.state === 'current');

              let icon = <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />;
              let titleColor = 'text-slate-500 dark:text-slate-400 font-medium';

              if (isDone) {
                icon = <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50 dark:fill-emerald-950/40" />;
                titleColor = 'text-emerald-700 dark:text-emerald-300 font-semibold';
              } else if (isCurrent) {
                icon = isReturn 
                  ? <RotateCcw className="w-4 h-4 text-purple-600 animate-spin" />
                  : <CircleDot className="w-4 h-4 text-blue-600 dark:text-indigo-400 animate-pulse" />;
                titleColor = isReturn
                  ? 'text-purple-600 dark:text-purple-400 font-bold'
                  : 'text-blue-600 dark:text-indigo-400 font-bold';
              } else if (isCancel) {
                icon = <XCircle className="w-4 h-4 text-rose-500 fill-rose-50 dark:fill-rose-950/40" />;
                titleColor = 'text-rose-600 dark:text-rose-400 font-bold';
              }

              return (
                <div key={idx} className="flex items-stretch gap-3.5 text-xs">
                  {/* Timeline Indicator Column (Icon + Centered Connector Line) */}
                  <div className="flex flex-col items-center shrink-0 w-5">
                    <div className="flex items-center justify-center w-5 h-5 shrink-0">
                      {icon}
                    </div>
                    {!isLast && (
                      <div
                        className={`w-0.5 grow my-1 rounded-full ${
                          isLineCompleted 
                            ? 'bg-emerald-500 dark:bg-emerald-500' 
                            : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      />
                    )}
                  </div>

                  {/* Step Details: Status & Description */}
                  <div className={`min-w-0 flex-1 pt-0.5 ${!isLast ? 'pb-4' : 'pb-1'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={titleColor}>{evt.status}</span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-semibold bg-blue-50 dark:bg-indigo-950/70 text-blue-600 dark:text-indigo-300 border border-blue-200 dark:border-indigo-800">
                          In Progress
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {evt.desc}
                    </div>
                  </div>

                  {/* Step Timestamp */}
                  <div className={`shrink-0 text-right pt-0.5 ${!isLast ? 'pb-4' : 'pb-1'}`}>
                    {evt.time ? (
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {evt.time}
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-300 dark:text-slate-600 italic">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Products List Table */}
        <div className={`rounded-2xl border ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
        } overflow-hidden shadow-sm`}>
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" />
              Order Items & Pricing ({order.items?.length || 0})
            </h4>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {order.items && order.items.map((item, idx) => {
              const itemTotal = (item.price || 0) * (item.qty || 1);
              const fallbackImage = `https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=100&auto=format&fit=crop&q=60`;

              return (
                <div key={idx} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.image || fallbackImage}
                      alt={item.name}
                      onError={(e) => {
                        e.target.src = fallbackImage;
                      }}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shrink-0 bg-slate-100 dark:bg-slate-800"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Unit: ₹{item.price?.toLocaleString()}</span>
                        <span>•</span>
                        <span className="font-semibold text-blue-600 dark:text-indigo-400 font-mono">
                          Qty: {item.qty}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                      ₹{itemTotal.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Line Total
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pricing & Financial Summary Breakdown */}
        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50/80 border-slate-200'
        } space-y-2 text-xs`}>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Items Gross Total:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              ₹{(order.totalAmount || order.netPayable || 0).toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span>Card Tier Savings:</span>
              {isCardMember ? (
                <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                  <CardTierIcon tier={normalizedTier} className="w-3.5 h-3.5" />
                  <span>({normalizedTier} Card)</span>
                </span>
              ) : (
                <span className="text-slate-400 italic">(Standard Non-Card)</span>
              )}
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {order.discountAmount > 0 ? `-₹${order.discountAmount.toLocaleString()}` : '₹0'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Payment Method & Status:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {order.paymentMode || 'Online (UPI)'} • <span className="text-emerald-600 font-semibold">Verified</span>
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between font-bold text-sm">
            <span className="text-slate-900 dark:text-white">Final Net Amount:</span>
            <span className="text-emerald-600 dark:text-emerald-400 text-base font-extrabold">
              ₹{order.netPayable?.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
