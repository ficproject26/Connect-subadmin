import React from 'react';
import { Modal } from './Modal';
import { StatusBadge, CardTierIcon } from './Badge';
import { useTheme } from '../context/ThemeContext';
import {
  CalendarCheck,
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
  ShieldCheck,
  User,
  Wrench,
  Building,
  Car,
  FileText,
  Phone,
  Users,
  Hotel
} from 'lucide-react';

export function BookingDetailsModal({ booking, isOpen, onClose }) {
  const { isDark } = useTheme();

  if (!booking) return null;

  const typeLower = (booking.bookingType || booking.type || booking.category || '').toLowerCase();
  const serviceLower = (booking.service || '').toLowerCase();
  const statusLower = (booking.status || '').toLowerCase().trim();

  const isStay = typeLower === 'stay' || serviceLower.includes('stay') || serviceLower.includes('hotel') || serviceLower.includes('villa') || serviceLower.includes('resort') || serviceLower.includes('room');
  const isTravel = typeLower === 'travel' || serviceLower.includes('travel') || serviceLower.includes('tour') || serviceLower.includes('cab') || serviceLower.includes('shuttle') || serviceLower.includes('trip') || serviceLower.includes('ride');

  // Determine representative / host
  let representativeName = booking.technicianName || booking.technicianAssigned || 'Not assigned';
  let representativeRole = 'Assigned Technician';
  let RepIcon = Wrench;
  let repId = booking.technicianId || 'Not provided';
  let repPhone = booking.technicianPhone || 'Not provided';

  if (isStay) {
    representativeName = booking.hotelName || booking.vendorName || booking.propertyName || 'Hotel Front Desk / Vendor';
    representativeRole = 'Hotel / Property Host';
    RepIcon = Hotel;
    repId = booking.vendorId || 'Not provided';
    repPhone = booking.vendorPhone || booking.contactPhone || 'Not provided';
  } else if (isTravel) {
    representativeName = booking.travelExecutive || booking.travelExecutiveName || 'Travel Coordinator';
    representativeRole = 'Travel Dispatcher';
    RepIcon = Car;
    repId = booking.executiveId || 'Not provided';
    repPhone = booking.executivePhone || 'Not provided';
  }

  const isCardMember = booking.membershipTier && 
    !['normal', 'standard', 'customer', 'none'].includes(String(booking.membershipTier).toLowerCase());
  const normalizedTier = isCardMember ? 
    (booking.membershipTier.charAt(0).toUpperCase() + booking.membershipTier.slice(1).toLowerCase()) : null;

  // Real timeline events from database delivery_status_history
  const buildTimeline = () => {
    let steps = [];
    if (isStay) {
      steps = [
        { status: 'Booking Requested', desc: 'Customer selected dates & requested hotel/room stay' },
        { status: 'Confirmed', desc: 'Vendor confirmed room reservation & payment verified' },
        { status: 'Check-in', desc: 'Guest arrived and completed hotel check-in' },
        { status: 'Check-out', desc: 'Guest completed room stay and checked out' },
        { status: 'Completed', desc: 'Stay concluded and verified' }
      ];
    } else if (isTravel) {
      steps = [
        { status: 'Booking Created', desc: 'Travel itinerary & pickup details scheduled' },
        { status: 'Confirmed', desc: 'Travel request verified & booking confirmed' },
        { status: 'Vehicle Assigned', desc: 'Driver & vehicle allocated for the journey' },
        { status: 'Pickup Started', desc: 'Driver en route to customer pickup doorstep' },
        { status: 'Completed', desc: 'Safely arrived at destination & trip completed' }
      ];
    } else {
      steps = [
        { status: 'Booking Created', desc: 'Customer placed service appointment request' },
        { status: 'Confirmed', desc: 'Appointment verified & parts inventory reserved' },
        { status: 'Technician Assigned', desc: 'Certified technician allocated to service ticket' },
        { status: 'In Progress', desc: 'On-site service inspection & repair underway' },
        { status: 'Completed', desc: 'Service completed & verified by customer sign-off' }
      ];
    }

    const dbTimeline = Array.isArray(booking.timeline) ? booking.timeline : [];

    // Helper to find real timestamp in database history
    const findHistory = (name) => {
      const n = name.toLowerCase();
      return dbTimeline.find(h => {
        const hs = (h.status || '').toLowerCase();
        if (n.includes('create') || n.includes('request')) {
          return hs.includes('placed') || hs.includes('request') || hs.includes('receive') || hs.includes('create');
        }
        return hs === n || hs.includes(n);
      });
    };

    let currentIdx = 0;
    if (statusLower === 'completed') currentIdx = steps.length - 1;
    else if (statusLower === 'check-out') currentIdx = isStay ? 3 : steps.length - 2;
    else if (statusLower === 'check-in' || statusLower === 'in progress' || statusLower === 'in-progress') currentIdx = isStay ? 2 : 3;
    else if (statusLower === 'confirmed') currentIdx = 1;
    else currentIdx = 0;

    return steps.map((s, idx) => {
      let state = 'upcoming';
      const hist = findHistory(s.status);

      if (idx < currentIdx) {
        state = 'completed';
      } else if (idx === currentIdx) {
        state = (idx === 0) ? 'completed' : 'current';
      }

      let time = null;
      if (hist && hist.time) {
        time = hist.time;
      } else if (idx === 0) {
        time = booking.scheduledDate || booking.bookingDate || 'Not provided';
      }

      return {
        status: s.status,
        desc: hist?.desc || s.desc,
        time,
        state
      };
    });
  };

  const timelineEvents = buildTimeline();

  // Financial calculations
  const baseCharge = Number(booking.charge || booking.totalAmount || booking.finalAmount || 0);
  const discountRate = normalizedTier === 'Diamond' ? 0.20 : normalizedTier === 'Gold' ? 0.15 : normalizedTier === 'Silver' ? 0.10 : 0;
  const discountAmount = isCardMember ? Math.round(baseCharge * discountRate) : 0;
  const netAmount = baseCharge - discountAmount;

  const guestsList = Array.isArray(booking.guests) ? booking.guests : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
            {booking.bookingNumber}
          </span>
          <StatusBadge status={booking.status} />
        </div>
      }
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Top Summary Card - Customer & Property / Provider Details */}
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
                  ID: {booking.customerId || 'Not provided'}
                </span>
              </div>

              <div>
                <div className="font-bold text-sm text-navy dark:text-white flex items-center gap-1.5">
                  <span>{booking.customerName}</span>
                  {normalizedTier && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      • {normalizedTier}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                  Phone: {booking.customerPhone && booking.customerPhone !== '-' ? booking.customerPhone : 'Not provided'}
                </div>
                {booking.customerEmail && booking.customerEmail !== 'Not provided' && (
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    Email: {booking.customerEmail}
                  </div>
                )}
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span>{booking.district || booking.state || 'Tamil Nadu'}{booking.division ? `, ${booking.division}` : ''}</span>
                  {booking.pincode && (
                    <>
                      <span>•</span>
                      <span className="font-mono">PIN: {booking.pincode}</span>
                    </>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2 mt-0.5" title={booking.customerAddress}>
                  {booking.customerAddress || 'Not provided'}
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Booking Date: <span className="font-medium text-navy-secondary dark:text-slate-200">{booking.bookingDate || booking.scheduledDate || 'Not provided'}</span></span>
              </div>
            </div>

            {/* Right: Hotel / Property / Provider Details */}
            <div className="pt-4 md:pt-0 md:pl-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-muted dark:text-slate-400 flex items-center gap-1.5">
                  <RepIcon className="w-3.5 h-3.5 text-navy dark:text-blue-400" />
                  {isStay ? 'Hotel / Property Details' : 'Provider Details'}
                </span>
                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[150px]" title={repId}>
                  ID: {repId}
                </span>
              </div>

              <div>
                <div className="font-bold text-sm text-navy dark:text-white">
                  {representativeName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">{representativeRole}</span>
                </div>
                {isStay && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 space-y-0.5">
                    <div>Room Type: <strong className="text-indigo-600 dark:text-indigo-400">{booking.roomName || 'Deluxe Room'}</strong></div>
                    <div>Room Number: <span className="font-mono">{booking.roomNumber || 'Not assigned'}</span></div>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Contact: <span className="font-medium text-navy-secondary dark:text-slate-200">{repPhone}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Hotel / Stay Specifics Card */}
        {isStay && (
          <div className={`p-4 rounded-2xl border ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
          } shadow-sm space-y-3`}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Hotel className="w-4 h-4 text-indigo-500" />
                Stay Reservation & Guest Details
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
                {booking.numberOfRooms || 1} Room(s) • {booking.numberOfGuests || 1} Guest(s)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Check-in</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{booking.checkInDate}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">{booking.checkInTime}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Check-out</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{booking.checkOutDate}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">{booking.checkOutTime}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Guest Count</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                  {booking.numberOfGuests} Guests
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  ({booking.adults || booking.numberOfGuests || 1} Adults{booking.children ? `, ${booking.children} Children` : ''})
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Room Allocation</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {booking.numberOfRooms || 1} Room(s)
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 truncate" title={booking.roomName}>
                  {booking.roomName || 'Deluxe'}
                </span>
              </div>
            </div>

            {/* Guests List (Only if individual guest records exist in database) */}
            {guestsList.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-2">
                  Individual Guest Roster ({guestsList.length})
                </div>
                <div className="space-y-1.5">
                  {guestsList.map((g, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/40 text-xs flex items-center justify-between">
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200">{g.name || `Guest ${idx + 1}`}</strong>
                        <span className="text-slate-400 ml-2">({g.gender || 'Adult'}, {g.age ? `${g.age} yrs` : 'Age not provided'})</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {g.idNumber ? `ID: ${g.idNumber}` : (g.aadhaar ? `Aadhaar: ${g.aadhaar}` : 'ID verified at desk')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic pt-1">
                Guest count registered: {booking.numberOfGuests} ({booking.adults || 1} Adults, {booking.children || 0} Children). Primary guest: {booking.customerName}.
              </div>
            )}
          </div>
        )}

        {/* Booking Status Timeline Stepper */}
        <div className={`p-4 sm:p-5 rounded-2xl border ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
        } shadow-sm`}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Booking Status Flow & Detailed Timeline
            </h4>
            <span className="text-[11px] text-slate-400">
              Current: <strong className="text-slate-700 dark:text-slate-200">{booking.status}</strong>
            </span>
          </div>

          {/* Stepper Timeline */}
          <div className="space-y-0">
            {timelineEvents.map((evt, idx) => {
              const isDone = evt.state === 'completed';
              const isCurrent = evt.state === 'current';
              const isLast = idx === timelineEvents.length - 1;

              const nextEvt = timelineEvents[idx + 1];
              const isLineCompleted = isDone && (nextEvt?.state === 'completed' || nextEvt?.state === 'current');

              let icon = <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />;
              let titleColor = 'text-slate-500 dark:text-slate-400 font-medium';

              if (isDone) {
                icon = <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50 dark:fill-emerald-950/40" />;
                titleColor = 'text-emerald-700 dark:text-emerald-300 font-semibold';
              } else if (isCurrent) {
                icon = <CircleDot className="w-4 h-4 text-blue-600 dark:text-indigo-400 animate-pulse" />;
                titleColor = 'text-blue-600 dark:text-indigo-400 font-bold';
              }

              return (
                <div key={idx} className="flex items-stretch gap-3.5 text-xs">
                  {/* Timeline Indicator Column */}
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

                  {/* Step Details */}
                  <div className={`min-w-0 flex-1 pt-0.5 ${!isLast ? 'pb-4' : 'pb-1'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={titleColor}>{evt.status}</span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-semibold bg-blue-50 dark:bg-indigo-950/70 text-blue-600 dark:text-indigo-300 border border-blue-200 dark:border-indigo-800">
                          Current Stage
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

        {/* Pricing & Financial Summary Breakdown */}
        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50/80 border-slate-200'
        } space-y-2 text-xs`}>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Booking Total Charge:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              ₹{baseCharge.toLocaleString()}
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
              {discountAmount > 0 ? `-₹${discountAmount.toLocaleString()}` : '₹0'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Payment Method & Status:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {booking.paymentMode || 'Online'} • <span className="text-emerald-600 font-semibold">{booking.paymentStatus || 'Paid'}</span>
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between font-bold text-sm">
            <span className="text-slate-900 dark:text-white">Final Net Amount:</span>
            <span className="text-emerald-600 dark:text-emerald-400 text-base font-extrabold">
              ₹{netAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
