import React from 'react';
import { Modal } from './Modal';
import { StatusBadge } from './Badge';
import { useTheme } from '../context/ThemeContext';
import {
  User,
  Building2,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  GraduationCap,
  Award,
  FileText,
  Eye,
  CheckCircle2,
  CircleDot,
  Circle,
  XCircle,
  Clock,
  Sparkles
} from 'lucide-react';

export function JobApplicationDetailsModal({ application, isOpen, onClose, onViewResume }) {
  const { isDark } = useTheme();

  if (!application) return null;

  const candidateName = application.customerName || 'Candidate';
  const appId = application.id || '-';
  const jobTitle = application.jobTitle || application.title || '-';
  const vendorName = application.vendorBusinessName || application.vendorName || application.company || '-';
  const vendorTerritory = application.vendorLocation || [application.vendorDistrict, application.vendorDivision, application.vendorPincode ? `PIN: ${application.vendorPincode}` : ''].filter(Boolean).join(', ');
  const jobType = application.jobType || 'Full-time';
  const appliedDate = application.applicationDate || application.createdAt || '-';
  const email = application.customerEmail || application.candidateEmail || application.email || '-';
  const phone = application.customerPhone || application.candidatePhone || application.phone || '-';
  const locationText = application.district ? `${application.district}${application.division ? `, ${application.division}` : ''}` : '-';
  const pincode = application.pincode || '-';
  const experience = application.experience || '-';
  const education = application.education || '-';
  const skills = Array.isArray(application.skills) ? application.skills : [];
  const resumeFileName = application.resumeName || (application.customerName ? `${application.customerName.replace(/\s+/g, '_')}_Resume.pdf` : 'Resume.pdf');

  // Determine timeline steps and active status
  const statusLower = (application.status || '').toLowerCase();
  const isRejected = statusLower.includes('reject');

  // Standard 6-stage progression
  const standardSteps = [
    {
      title: 'Application Submitted',
      desc: 'Customer submitted application with verified profile & resume',
      time: appliedDate
    },
    {
      title: 'Under Review',
      desc: 'Vendor HR reviewed credentials, experience, and eligibility',
      time: application.reviewedAt || null
    },
    {
      title: 'Shortlisted',
      desc: 'Candidate profile shortlisted for technical evaluation',
      time: application.shortlistedAt || null
    },
    {
      title: 'Interview',
      desc: 'Technical & HR interview rounds scheduled and conducted',
      time: application.interviewScheduledAt || null
    },
    {
      title: 'Selected / Offer',
      desc: 'Candidate selected and official employment offer released',
      time: application.offeredAt || null
    },
    {
      title: 'Completed',
      desc: 'Offer accepted, verification verified, and onboarding completed',
      time: application.completedAt || null
    }
  ];

  let currentStepIdx = 0;
  if (statusLower.includes('completed')) {
    currentStepIdx = 5;
  } else if (statusLower.includes('selected') || statusLower.includes('offer') || statusLower.includes('hired')) {
    currentStepIdx = 4;
  } else if (statusLower.includes('interview')) {
    currentStepIdx = 3;
  } else if (statusLower.includes('shortlist')) {
    currentStepIdx = 2;
  } else if (statusLower.includes('review')) {
    currentStepIdx = 1;
  } else {
    currentStepIdx = 0;
  }

  // Determine stage where rejection occurred if status is Rejected
  let rejectedStepIdx = 1; // Default to Under Review if rejected with no prior stage noted
  if (isRejected) {
    if (application.rejectedAtStep !== undefined && application.rejectedAtStep !== null) {
      rejectedStepIdx = Math.min(Math.max(Number(application.rejectedAtStep), 0), 5);
    } else {
      const stageCheck = (application.rejectedStage || application.previousStatus || application.stage || '').toLowerCase();
      if (stageCheck.includes('completed')) rejectedStepIdx = 5;
      else if (stageCheck.includes('offer') || stageCheck.includes('selected')) rejectedStepIdx = 4;
      else if (stageCheck.includes('interview')) rejectedStepIdx = 3;
      else if (stageCheck.includes('shortlist')) rejectedStepIdx = 2;
      else if (stageCheck.includes('submit') || stageCheck.includes('pending')) rejectedStepIdx = 0;
      else rejectedStepIdx = 1;
    }
  }

  const timelineSteps = standardSteps.map((step, idx) => {
    if (!isRejected) {
      const isCompleted = idx < currentStepIdx;
      const isCurrent = idx === currentStepIdx;
      return {
        ...step,
        state: isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming',
        time: idx <= currentStepIdx ? step.time : '—'
      };
    } else {
      if (idx < rejectedStepIdx) {
        return {
          ...step,
          state: 'completed',
          time: step.time
        };
      } else if (idx === rejectedStepIdx) {
        return {
          title: step.title,
          desc: application.rejectionReason || `Application rejected by vendor at ${step.title.toLowerCase()} stage`,
          state: 'rejected',
          time: application.rejectedAt || '2026-03-06 03:30 PM'
        };
      } else {
        return {
          ...step,
          state: 'cancelled',
          time: '—'
        };
      }
    }
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
            {appId}
          </span>
          <StatusBadge status={application.status} />
        </div>
      }
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Top Summary Card - 50/50 Split */}
        <div
          className={`p-4 rounded-xl border ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 gap-4 sm:gap-0">
            {/* Left: Candidate Information */}
            <div className="sm:pr-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Candidate Information
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                  Applicant
                </span>
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {candidateName}
                </h4>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{email}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="font-mono">{phone}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>PIN: {pincode}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 pl-5">
                  {locationText}
                </div>
              </div>
            </div>

            {/* Right: Job & Hiring Vendor Info */}
            <div className="sm:pl-5 pt-4 sm:pt-0 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Target Position & Vendor
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                  {jobType}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {jobTitle}
                </h4>
                <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center gap-1">
                  <span>{vendorName}</span>
                </div>
                {vendorTerritory && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{vendorTerritory}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Applied On:
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {appliedDate}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    Application Ref:
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                    {appId}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Application Lifecycle Stepper */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Application Process & Status Timeline
            </h4>
            <span className="text-[11px] font-mono text-slate-400">
              {isRejected
                ? `Rejected at Stage ${rejectedStepIdx + 1} of 6`
                : `Stage ${currentStepIdx + 1} of 6`}
            </span>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="relative pl-6 space-y-6">
              {/* Connecting vertical line */}
              <div
                className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-800"
                aria-hidden="true"
              />

              {timelineSteps.map((step, idx) => {
                const isCompleted = step.state === 'completed';
                const isCurrent = step.state === 'current';
                const isRejectedStep = step.state === 'rejected';
                const isCancelled = step.state === 'cancelled';

                return (
                  <div key={idx} className="relative flex items-start justify-between gap-4">
                    {/* Step Icon Indicator */}
                    <div className="absolute -left-6 mt-0.5">
                      {isCompleted ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      ) : isCurrent ? (
                        <div className="relative flex items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-blue-400 opacity-75" />
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm relative">
                            <CircleDot className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ) : isRejectedStep ? (
                        <div className="relative flex items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-rose-400 opacity-75" />
                          <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-sm relative">
                            <XCircle className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-400 flex items-center justify-center">
                          <Circle className="w-2.5 h-2.5 fill-current opacity-40" />
                        </div>
                      )}
                    </div>

                    {/* Step Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold ${
                            isCompleted
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isCurrent
                              ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                              : isRejectedStep
                              ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                              : isCancelled
                              ? 'text-slate-400 dark:text-slate-500 line-through opacity-60'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {step.title}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-semibold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Current Stage
                          </span>
                        )}
                        {isRejectedStep && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-semibold bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            Rejected
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {step.desc}
                      </p>
                    </div>

                    {/* Step Timestamp */}
                    <div className="text-right shrink-0 text-[11px] font-mono text-slate-400">
                      {step.time}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Qualifications, Education & Skills */}
        <div
          className={`p-4 rounded-xl border ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/70 border-slate-200'
          }`}
        >
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            Candidate Credentials & Background
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-slate-500" />
                Work Experience
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{experience}</p>
            </div>

            <div className="p-3 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                <GraduationCap className="w-3 h-3 text-slate-500" />
                Education & Certification
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{education}</p>
            </div>
          </div>

          <div className="mt-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">
              Key Skills & Technical Competencies
            </span>
            <div className="flex flex-wrap gap-1.5">
              {skills.length === 0 ? (
                <span className="text-xs text-slate-400">None specified</span>
              ) : (
                skills.map((skill, sIdx) => (
                  <span
                    key={sIdx}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs"
                  >
                    {skill}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Resume Quick Access Banner */}
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isDark
              ? 'bg-gradient-to-r from-blue-950/40 to-slate-900 border-blue-900/60'
              : 'bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>{resumeFileName}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                  PDF
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Official candidate curriculum vitae & credential sheet
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onViewResume) onViewResume(application);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow transition cursor-pointer shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Open Resume PDF</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
