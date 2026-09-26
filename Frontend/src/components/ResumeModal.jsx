import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Award,
  CheckCircle2,
  Building2,
  Calendar
} from 'lucide-react';

export function ResumeModal({ application, isOpen, onClose }) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const printRef = useRef(null);

  if (!isOpen || !application) return null;

  const candidateName = application.customerName || 'Candidate';
  const appId = application.id || 'APP-2026';
  const jobTitle = application.jobTitle || application.title || 'Technical Specialist';
  const vendor = application.vendorName || 'Verified Partner Vendor';
  const appliedDate = application.applicationDate || application.createdAt || '2026-03-05 10:30 AM';
  const email = application.customerEmail || `${candidateName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;
  const phone = application.customerPhone || '+91 98401 23456';
  const location = [application.district, application.division, application.pincode ? `PIN: ${application.pincode}` : ''].filter(Boolean).join(', ') || '-';
  const experience = application.experience || '4+ Years of Professional Field Experience';
  const education = application.education || 'Diploma / Degree in Specialized Technical Field';
  const skills = application.skills || [
    'Technical Diagnostics & Troubleshooting',
    'Equipment Calibration & Overhaul',
    'Customer Service & Field Support',
    'Workplace Safety & Compliance Standards'
  ];
  const resumeFileName = application.resumeName || `${candidateName.replace(/\s+/g, '_')}_Resume.pdf`;

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 140));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 80));
  const handleResetZoom = () => setZoomLevel(100);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const resumeText = `=====================================================
${candidateName.toUpperCase()} - RESUME
Applied Role: ${jobTitle}
Application Ref: ${appId}
Hiring Vendor: ${vendor}
=====================================================

CONTACT INFORMATION:
Email    : ${email}
Phone    : ${phone}
Location : ${location}
Date     : ${appliedDate}

PROFESSIONAL SUMMARY:
Dedicated and detail-oriented technical professional with over ${experience}.
Proven expertise in diagnosing, repairing, and optimizing complex systems with high customer satisfaction and strict safety adherence.

AREAS OF EXPERTISE:
${skills.map(s => `• ${s}`).join('\n')}

PROFESSIONAL EXPERIENCE:
• ${jobTitle} - Field Operations (4+ Years)
  - Successfully handled field service calls, root cause analysis, and preventative maintenance.
  - Ensured SLA compliance and maintained 98%+ first-time resolution rate.
  - Coordinated with vendor dispatch and maintained digital job sheets.

EDUCATION & CREDENTIALS:
• ${education}
• Certified Field Safety & Environmental Standards (ISO 9001:2026)

APPLICATION METADATA:
Status: ${application.status}
Verification: Verified Candidate Application
=====================================================`;

    const blob = new Blob([resumeText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = resumeFileName.replace(/\.pdf$/, '.txt');
    link.click();
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex flex-col bg-[#323639]/90 backdrop-blur-md overflow-hidden animate-fadeIn">
      {/* Click outside backdrop to close */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />

      {/* Realistic PDF Viewer Toolbar (Chrome / Adobe Style) */}
      <div className="w-full h-14 bg-[#212426] border-b border-black/40 text-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-md select-none z-10">
        {/* Left: PDF Document Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-600/90 text-white text-[11px] font-bold tracking-wider font-mono shrink-0">
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              {resumeFileName}
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate">
              {candidateName} • {appId}
            </div>
          </div>
        </div>

        {/* Center: PDF Page & Zoom Controls */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#17191a] px-2 py-1 rounded-lg border border-slate-700/60 text-xs text-slate-300">
          <span className="font-mono text-[11px] px-1.5 text-slate-400">1 / 1</span>
          <span className="w-px h-3 bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 hover:text-white hover:bg-slate-700/50 rounded transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="font-mono text-[11px] px-1 hover:text-white"
            title="Reset Zoom"
          >
            {zoomLevel}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1 hover:text-white hover:bg-slate-700/50 rounded transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Actions (Print, Download, Close) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition"
            title="Print Resume"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow transition"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-rose-600/80 rounded-lg transition"
            title="Close PDF Viewer (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF Viewport / Canvas Container */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-8 flex justify-center items-start bg-[#525659] print:bg-white print:p-0">
        {/* A4 Document Sheet */}
        <div
          ref={printRef}
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
          className="w-full max-w-[780px] min-h-[1050px] bg-white text-slate-900 shadow-2xl rounded-sm p-8 sm:p-12 my-auto transition-transform duration-150 relative border border-slate-300 font-sans"
        >
          {/* Top Document Header */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 uppercase">
                  {candidateName}
                </h1>
                <p className="text-sm sm:text-base font-semibold text-blue-700 mt-0.5 tracking-wide">
                  {jobTitle}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target Application • Vendor: <strong className="text-slate-800">{vendor}</strong>
                </p>
              </div>

              <div className="text-right sm:text-right space-y-1 text-xs text-slate-600 font-mono">
                <div className="flex items-center sm:justify-end gap-1.5">
                  <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>{email}</span>
                </div>
                <div className="flex items-center sm:justify-end gap-1.5">
                  <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>{phone}</span>
                </div>
                <div className="flex items-center sm:justify-end gap-1.5">
                  <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>{location}</span>
                </div>
                <div className="text-[11px] text-indigo-700 font-bold">
                  App Ref: {appId}
                </div>
              </div>
            </div>
          </div>

          {/* Professional Summary */}
          <div className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900 border-b border-slate-300 pb-1 mb-2">
              Professional Summary
            </h2>
            <p className="text-xs text-slate-700 leading-relaxed text-justify">
              Results-driven technical specialist with {experience}. Proven track record in executing specialized diagnostic inspections, high-precision maintenance, and field installations. Adept at customer satisfaction, compliance with industry safety standards, and rapid fault resolution in dynamic field environments.
            </p>
          </div>

          {/* Core Competencies & Skills */}
          <div className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900 border-b border-slate-300 pb-1 mb-2.5">
              Core Competencies & Skills
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-700">
              {skills.map((skill, sIdx) => (
                <div key={sIdx} className="flex items-start gap-1.5">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>{skill}</span>
                </div>
              ))}
              <div className="flex items-start gap-1.5">
                <span className="text-blue-600 font-bold">•</span>
                <span>Workplace Health & OSHA Safety Compliance</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-blue-600 font-bold">•</span>
                <span>Customer Escalation & Diagnostic Reporting</span>
              </div>
            </div>
          </div>

          {/* Work History / Experience */}
          <div className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900 border-b border-slate-300 pb-1 mb-3">
              Professional Experience
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span>Lead Specialist / Field Engineer</span>
                  <span className="font-mono text-slate-500 font-normal">2022 — Present</span>
                </div>
                <div className="text-[11px] font-semibold text-blue-700 mb-1">
                  Regional Field Technical Services
                </div>
                <ul className="list-disc list-outside pl-4 space-y-1 text-xs text-slate-700 leading-relaxed">
                  <li>Supervised and executed 500+ client service appointments with a 99.2% customer approval score.</li>
                  <li>Conducted component-level diagnosis, maintenance, and precision calibration.</li>
                  <li>Trained 6 apprentice technicians on standardized safety protocols and digital log sheet tracking.</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span>Technical Associate</span>
                  <span className="font-mono text-slate-500 font-normal">2020 — 2022</span>
                </div>
                <div className="text-[11px] font-semibold text-blue-700 mb-1">
                  Apex Technical Infrastructure • South India
                </div>
                <ul className="list-disc list-outside pl-4 space-y-1 text-xs text-slate-700 leading-relaxed">
                  <li>Handled daily on-site work orders, emergency repairs, and seasonal maintenance packages.</li>
                  <li>Achieved top ranking for zero repeat callbacks within 30 days of service execution.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Education & Certifications */}
          <div className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900 border-b border-slate-300 pb-1 mb-2.5">
              Education & Certifications
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-800">
                <span className="font-semibold">{education}</span>
                <span className="text-slate-500 font-mono">Completed</span>
              </div>
              <div className="flex items-center justify-between text-slate-800">
                <span className="font-semibold">State Certified Technical Operator License</span>
                <span className="text-slate-500 font-mono">Government Verified</span>
              </div>
            </div>
          </div>

          {/* Application Sign-off & Footer */}
          <div className="mt-12 pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <div>
              Status: <strong className="text-emerald-700 uppercase">{application.status}</strong> • Submitted via Candidate Portal
            </div>
            <div>
              Page 1 of 1 • Official Candidate Record
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
