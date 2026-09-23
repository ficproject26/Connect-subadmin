import React, { useState, useEffect, useCallback } from "react";
import { dataService } from "../services/dataService";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  FileText, CheckCircle, XCircle,
  Store, ClipboardList, Eye, X,
  Building2, Navigation, Layers,
  Search, ShieldCheck, BadgeCheck, Mic, Calendar, Printer,
  ThumbsUp, ThumbsDown, AlertCircle, MessageSquare
} from "lucide-react";

function formatRole(role = "") {
  const r = role.toLowerCase();
  if (r.includes("state")) return "State Manager";
  if (r.includes("district")) return "District Manager";
  if (r.includes("division")) return "Division Manager";
  if (r.includes("pincode")) return "Pincode Manager";
  return role.replace(/_/g, " ");
}

function roleBadgeCls(role = "", isDark) {
  const r = role.toLowerCase();
  if (r.includes("state")) return isDark ? "bg-sky-900/60 text-sky-300 border-sky-700" : "bg-sky-50 text-sky-700 border-sky-200";
  if (r.includes("district")) return isDark ? "bg-violet-900/60 text-violet-300 border-violet-700" : "bg-violet-50 text-violet-700 border-violet-200";
  if (r.includes("division")) return isDark ? "bg-amber-900/60 text-amber-300 border-amber-700" : "bg-amber-50 text-amber-700 border-amber-200";
  return isDark ? "bg-emerald-900/60 text-emerald-300 border-emerald-700" : "bg-emerald-50 text-emerald-700 border-emerald-200";
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function ReportDetailModal({ report, isDark, onClose }) {
  if (!report) return null;
  const s = report.summary || {};

  const handlePrint = () => {
    const printContent = document.getElementById("printable-admin-report-card");
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Field Performance Report - ${report.reportNumber || report.managerName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body { font-family: 'Inter', sans-serif; background: #ffffff; color: #0f172a; margin: 20px; font-size: 12px; }
            .no-print { display: none !important; }
            h1, h2, h3, h4 { margin: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
            th { background: #f8fafc; font-weight: 700; font-size: 11px; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px; }
            .grid-kpi { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 15px 0; }
            .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(6px)"
      }}
    >
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }} />

      <div
        id="printable-admin-report-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "860px",
          maxHeight: "min(92vh, 880px)",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          zIndex: 1
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid #f1f5f9",
            background: "#f8fafc",
            flexShrink: 0
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "linear-gradient(135deg, #0284c7, #0369a1)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(2, 132, 199, 0.25)"
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Official Field Performance Report
              </h3>
              <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "2px 0 0" }}>
                Report No: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{report.reportNumber}</span>
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}
              title="Export and print official report PDF"
            >
              <Printer size={15} style={{ color: "#0284c7" }} />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#64748b"
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* 1. Report Header Banner */}
          <div
            style={{
              padding: "16px 20px",
              background: "#f8fafc",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: "0.74rem",
                    fontWeight: 800,
                    background: "#dcfce7",
                    color: "#15803d",
                    padding: "2px 8px",
                    borderRadius: 6
                  }}
                >
                  {formatRole(report.managerRole)}
                </span>
                <h4 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                  {report.managerName}
                </h4>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}>
                Jurisdiction: {report.district || "District"} {report.division ? `• ${report.division}` : ""} {report.pincode ? `• PIN: ${report.pincode}` : ""}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.74rem", color: "#64748b" }}>
                Submitted: <strong>{report.submittedAt ? new Date(report.submittedAt).toLocaleString() : "—"}</strong>
              </div>
              <div style={{ marginTop: 4 }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: 20,
                    background: "#d1fae5",
                    color: "#047857",
                    border: "1px solid #a7f3d0"
                  }}
                >
                  Status: {report.status || "Submitted"}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Performance Summary Metrics */}
          <div>
            <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
              Report Performance Summary ({report.dateRange || report.periodLabel})
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
              <div style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b" }}>Total Visits</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#0f172a", marginTop: 2 }}>
                  {s.totalVisits ?? (report.shopVisits?.length || 0)}
                </div>
              </div>

              <div style={{ padding: "12px 14px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#16a34a" }}>Interested</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#15803d", marginTop: 2 }}>
                  {s.interested ?? 0}
                </div>
              </div>

              <div style={{ padding: "12px 14px", background: "#fef2f2", borderRadius: 10, border: "1px solid #fecaca" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#dc2626" }}>Not Interested</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#b91c1c", marginTop: 2 }}>
                  {s.notInterested ?? 0}
                </div>
              </div>

              <div style={{ padding: "12px 14px", background: "#f0f9ff", borderRadius: 10, border: "1px solid #bae6fd" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#0284c7" }}>New Tie-ups</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#0369a1", marginTop: 2 }}>
                  {s.newTieups ?? 0}
                </div>
              </div>

              <div style={{ padding: "12px 14px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#16a34a" }}>Tasks Done</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#15803d", marginTop: 2 }}>
                  {s.tasksCompleted ?? 0}
                </div>
              </div>

              <div style={{ padding: "12px 14px", background: "#fffbeb", borderRadius: 10, border: "1px solid #fde68a" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#d97706" }}>Tasks Pending</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#b45309", marginTop: 2 }}>
                  {s.tasksPending ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Shop Visit Audit Details */}
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#0f172a", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Store size={16} style={{ color: "#0284c7" }} />
              <span>Shop Visit Records ({report.shopVisits?.length || 0})</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(report.shopVisits || []).map((v, vIdx) => (
                <div
                  key={v._id || v.id || vIdx}
                  style={{
                    padding: "14px 16px",
                    background: "#f8fafc",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden"
                        }}
                      >
                        {(() => {
                          const pUrl = (v.shopPhoto && !v.shopPhoto.startsWith("blob:")) ? v.shopPhoto : (v.vendor?.documents?.[0]?.url || null);
                          return pUrl ? (
                            <img src={pUrl} alt="Shop" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <Store size={18} style={{ color: "#0284c7" }} />
                          );
                        })()}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#e0f2fe", color: "#0369a1" }}>
                            {v.category || "Products"}
                          </span>
                          <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>{v.shopName}</strong>
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: 2 }}>
                          {v.pincode && <span>PIN: {v.pincode} • </span>}
                          {v.createdAt && <span>Visited: {new Date(v.createdAt).toLocaleString()}</span>}
                        </div>
                      </div>
                    </div>

                    <div>
                      {v.interestedStatus === "YES" ? (
                        <span style={{ fontSize: "0.72rem", fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" }}>
                          ✓ Interested
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.72rem", fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" }}>
                          ✕ Not Interested
                        </span>
                      )}
                    </div>
                  </div>

                  {v.notInterestedReason && (
                    <div style={{ fontSize: "0.76rem", color: "#b91c1c", background: "#fef2f2", padding: "6px 10px", borderRadius: 6 }}>
                      <strong>Reason:</strong> {v.notInterestedReason}
                    </div>
                  )}

                  {/* Vendor Approval & KYC Details */}
                  {v.vendor && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, padding: "10px 12px", background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <div>
                        <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Pincode Admin Approval</div>
                        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: (v.vendor.approvalStatus || "").toLowerCase().includes("approved") ? "#15803d" : "#d97706", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <BadgeCheck size={14} />
                          <span>{v.vendor.approvalStatus || "Pending Pincode Admin Approval"}</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>KYC Status</div>
                        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: (v.vendor.kycStatus || "").toLowerCase().includes("verified") ? "#15803d" : "#0284c7", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <ShieldCheck size={14} />
                          <span>{v.vendor.kycStatus || "Pending Verification"}</span>
                        </div>
                      </div>

                      {v.vendor.bankName && (
                        <div>
                          <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Bank Details</div>
                          <div style={{ fontSize: "0.76rem", color: "#0f172a", marginTop: 2 }}>
                            {v.vendor.bankName} • A/C: {v.vendor.accountNumber ? `••••${v.vendor.accountNumber.slice(-4)}` : "—"} (IFSC: {v.vendor.ifsc || "—"})
                          </div>
                        </div>
                      )}

                      {v.vendor.documents && v.vendor.documents.length > 0 && (
                        <div>
                          <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Submitted Documents</div>
                          <div style={{ fontSize: "0.76rem", color: "#0284c7", marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {v.vendor.documents.map((doc, dIdx) => (
                              <a key={dIdx} href={doc.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", color: "#0284c7" }}>
                                {doc.name || `Document ${dIdx+1}`}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {v.voiceNote && (
                    <div style={{ padding: "8px 12px", background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10 }}>
                      <Mic size={15} style={{ color: "#d97706" }} />
                      <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#0f172a" }}>Voice Audit Note:</span>
                      <audio controls src={v.voiceNote} style={{ height: 28, flex: 1 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 4. Task Audit Details */}
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#0f172a", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <ClipboardList size={16} style={{ color: "#0284c7" }} />
              <span>Tasks Executed in Period ({report.tasks?.length || 0})</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(report.tasks || []).map((t, tIdx) => (
                <div
                  key={t.id || tIdx}
                  style={{
                    padding: "12px 16px",
                    background: "#ffffff",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap"
                  }}
                >
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: t.status === "Completed" ? "#d1fae5" : "#fef3c7",
                          color: t.status === "Completed" ? "#047857" : "#b45309"
                        }}
                      >
                        {t.status}
                      </span>
                      <strong style={{ fontSize: "0.86rem", color: "#0f172a" }}>{t.title}</strong>
                    </div>
                    {t.description && (
                      <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: 3 }}>
                        {t.description}
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: "0.76rem", color: "#64748b", textAlign: "right" }}>
                    <div>Due: {t.dueDate || "—"}</div>
                    {t.completionDetails && (
                      <div style={{ color: "#059669", fontWeight: 600, marginTop: 2 }}>
                        {t.completionDetails}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 24px",
            borderTop: "1px solid #f1f5f9",
            background: "#f8fafc",
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
            Forge India Connect Supervisory Audit System
          </span>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: "#0f172a",
              color: "#ffffff",
              fontSize: "0.84rem",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export function ManagerReportsPanel() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const userRole = (user?.role || "").toLowerCase();
  const isPincodeAdmin = userRole.includes("pincode");
  const isDivisionalAdmin = userRole.includes("division") || userRole.includes("divisional");
  const isDistrictAdmin = userRole.includes("district");
  const isStateAdmin = userRole.includes("state") || userRole.includes("super");
  // Only Pincode Admin can approve/reject manager reports
  const canApproveReports = isPincodeAdmin;

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hierarchy, setHierarchy] = useState({ districts:[], divisions:[], pincodes:[] });
  const [selectedReport, setSelectedReport] = useState(null);
  const [search, setSearch] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("All");
  const [filterDivision, setFilterDivision] = useState("All");
  const [filterPincode, setFilterPincode] = useState("All");
  const [filterRole, setFilterRole] = useState("All");

  // Approval workflow state
  const [approvalModal, setApprovalModal] = useState(null); // { type: 'approve'|'reject', report }
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalToast, setApprovalToast] = useState(null); // { type: 'success'|'error', msg }

  const showToast = (type, msg) => {
    setApprovalToast({ type, msg });
    setTimeout(() => setApprovalToast(null), 3500);
  };

  const handleApprove = async () => {
    if (!approvalModal) return;
    setApprovalLoading(true);
    try {
      const reportId = approvalModal.report._id || approvalModal.report.id;
      const res = await dataService.approveManagerReport(reportId, approvalRemarks);
      if (res && res.success) {
        showToast('success', `Report approved successfully!`);
        setApprovalModal(null);
        setApprovalRemarks("");
        load(); // refresh list
      } else {
        showToast('error', res?.message || 'Failed to approve report.');
      }
    } catch (e) {
      showToast('error', e.message || 'Failed to approve report.');
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleReject = async () => {
    if (!approvalModal) return;
    if (!approvalRemarks.trim()) {
      showToast('error', 'Please provide remarks for rejection.');
      return;
    }
    setApprovalLoading(true);
    try {
      const reportId = approvalModal.report._id || approvalModal.report.id;
      const res = await dataService.rejectManagerReport(reportId, approvalRemarks);
      if (res && res.success) {
        showToast('success', `Report rejected.`);
        setApprovalModal(null);
        setApprovalRemarks("");
        load();
      } else {
        showToast('error', res?.message || 'Failed to reject report.');
      }
    } catch (e) {
      showToast('error', e.message || 'Failed to reject report.');
    } finally {
      setApprovalLoading(false);
    }
  };

  const cardBg = isDark ? "bg-[#131f37] border-[#1f3358]" : "bg-white border-slate-200/90 shadow-sm";
  const selCls = `w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${isDark?"bg-slate-800 border-slate-700 text-slate-300":"bg-slate-50 border-slate-200 text-slate-700"}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterDistrict !== "All") params.district = filterDistrict;
      if (filterDivision !== "All") params.division = filterDivision;
      if (filterPincode !== "All") params.pincode = filterPincode;
      if (filterRole !== "All") params.managerRole = filterRole;
      if (search.trim()) params.search = search.trim();
      const res = await dataService.getSubmittedManagerReports(params);
      if (res && res.success) {
        setReports(res.data || []);
        if (res.hierarchy) setHierarchy(res.hierarchy);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [filterDistrict, filterDivision, filterPincode, filterRole, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className={`text-base font-black flex items-center gap-2 ${isDark?"text-white":"text-slate-900"}`}>
            <FileText className="w-5 h-5 text-blue-500"/>Manager Field Reports
          </h3>
          <p className={`text-xs mt-0.5 ${isDark?"text-slate-400":"text-slate-500"}`}>
            {isPincodeAdmin 
              ? `Submitted performance reports from Pincode Managers in your jurisdiction (PIN: ${user?.pincode || "636114"})`
              : "Submitted performance reports from field managers in your jurisdiction"}
          </p>
        </div>
        <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold border ${isDark?"bg-blue-900/40 text-blue-300 border-blue-700":"bg-blue-50 text-blue-700 border-blue-200"}`}>
          {reports.length} Report{reports.length!==1?"s":""}
        </span>
      </div>

      {/* Filters */}
      <div className={`rounded-2xl border p-4 ${isPincodeAdmin ? "flex items-center" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"} gap-3 ${cardBg}`}>
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark?"text-slate-500":"text-slate-400"}`}/>
          <input type="text" placeholder="Search manager or report number..." value={search} onChange={e=>setSearch(e.target.value)}
            className={`w-full pl-8 pr-3 py-2 rounded-xl text-xs font-semibold border outline-none ${isDark?"bg-slate-800 border-slate-700 text-slate-300 placeholder-slate-500":"bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400"}`}/>
        </div>
        {!isPincodeAdmin && isStateAdmin && hierarchy.districts.length>0 && (
          <select value={filterDistrict} onChange={e=>setFilterDistrict(e.target.value)} className={selCls}>
            <option value="All">All Districts</option>
            {hierarchy.districts.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {!isPincodeAdmin && (isStateAdmin || isDistrictAdmin) && hierarchy.divisions.length>0 && (
          <select value={filterDivision} onChange={e=>setFilterDivision(e.target.value)} className={selCls}>
            <option value="All">All Divisions</option>
            {hierarchy.divisions.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {!isPincodeAdmin && (isStateAdmin || isDistrictAdmin || isDivisionalAdmin) && hierarchy.pincodes.length>0 && (
          <select value={filterPincode} onChange={e=>setFilterPincode(e.target.value)} className={selCls}>
            <option value="All">All Pincodes</option>
            {hierarchy.pincodes.map(p=><option key={p} value={p}>PIN {p}</option>)}
          </select>
        )}
        {!isPincodeAdmin && (
          <select value={filterRole} onChange={e=>setFilterRole(e.target.value)} className={selCls}>
            <option value="All">All Manager Tiers</option>
            <option value="pincode">Pincode Managers</option>
            {(isDivisionalAdmin || isDistrictAdmin || isStateAdmin) && (
              <option value="division">Division Managers</option>
            )}
            {(isDistrictAdmin || isStateAdmin) && (
              <option value="district">District Managers</option>
            )}
            {isStateAdmin && (
              <option value="state">State Managers</option>
            )}
          </select>
        )}
      </div>

      {/* Table */}
      <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
        {loading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[...Array(4)].map((_,i)=>(
              <div key={i} className={`h-12 rounded-xl ${isDark?"bg-slate-800":"bg-slate-100"}`}/>
            ))}
          </div>
        ) : reports.length===0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText className={`w-10 h-10 ${isDark?"text-slate-600":"text-slate-300"}`}/>
            <div className={`text-sm font-bold ${isDark?"text-slate-400":"text-slate-500"}`}>No manager reports found</div>
            <div className={`text-xs ${isDark?"text-slate-600":"text-slate-400"}`}>Reports submitted by field managers will appear here</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full text-left text-xs ${isDark?"text-slate-300":"text-slate-800"}`}>
              <thead className={`${isDark?"bg-slate-950/60 text-slate-400 border-slate-800":"bg-slate-50 text-slate-500 border-slate-200"} uppercase text-[10px] border-b`}>
                <tr>
                  <th className="px-4 py-3">Manager</th>
                  <th className="px-4 py-3">Territory</th>
                  <th className="px-4 py-3">Report Period</th>
                  <th className="px-4 py-3 text-center">Visits</th>
                  <th className="px-4 py-3 text-center">Interested</th>
                  <th className="px-4 py-3 text-center">Tasks</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">View</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark?"divide-slate-800/60":"divide-slate-100"}`}>
                {reports.map(rpt => (
                  <tr key={rpt._id||rpt.id} className={`transition-colors ${isDark?"hover:bg-slate-800/30":"hover:bg-slate-50/80"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${isDark?"bg-blue-900/60 text-blue-300":"bg-blue-100 text-blue-700"}`}>
                          {(rpt.managerName||"M").slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div className={`font-bold ${isDark?"text-white":"text-slate-900"}`}>{rpt.managerName}</div>
                          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${roleBadgeCls(rpt.managerRole,isDark)}`}>{formatRole(rpt.managerRole)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`font-semibold ${isDark?"text-slate-200":"text-slate-900"}`}>{rpt.district||"—"}{rpt.division?` › ${rpt.division}`:""}</div>
                      {rpt.pincode&&<div className={`font-mono text-[10px] mt-0.5 ${isDark?"text-slate-500":"text-slate-400"}`}>PIN {rpt.pincode}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`font-semibold ${isDark?"text-slate-200":"text-slate-900"}`}>{rpt.dateRange||rpt.periodLabel}</div>
                      <div className={`font-mono text-[9px] mt-0.5 ${isDark?"text-slate-500":"text-slate-400"}`}>{rpt.reportNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-base font-black ${isDark?"text-white":"text-slate-900"}`}>{rpt.summary?.totalVisits??rpt.shopVisits?.length??0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-emerald-600 font-bold">{rpt.summary?.interested??0}</span>
                      {(rpt.summary?.newTieups??0)>0&&(
                        <span className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${isDark?"bg-emerald-900/40 text-emerald-300 border-emerald-700":"bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{rpt.summary.newTieups} tie-up</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isDark?"bg-amber-900/30 text-amber-300 border-amber-700":"bg-amber-50 text-amber-700 border-amber-200"}`}>
                        <CheckCircle className="w-3 h-3"/>{rpt.summary?.tasksCompleted??0}/{rpt.summary?.tasksAssigned??rpt.tasks?.length??0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const st = rpt.approvalStatus || rpt.status || 'Submitted';
                        const isApproved = st === 'Approved';
                        const isRejected = st === 'Rejected';
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isApproved
                              ? (isDark ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                              : isRejected
                              ? (isDark ? 'bg-red-900/40 text-red-300 border-red-800' : 'bg-red-50 text-red-700 border-red-200')
                              : (isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-200')
                          }`}>
                            {isApproved ? <CheckCircle className="w-3 h-3"/> : isRejected ? <XCircle className="w-3 h-3"/> : <AlertCircle className="w-3 h-3"/>}
                            {st}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={()=>setSelectedReport(rpt)}
                          className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition ${isDark?"bg-blue-900/40 text-blue-300 border-blue-700 hover:bg-blue-800/60":"bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"}`}>
                          <Eye className="w-3 h-3"/>View
                        </button>
                        {canApproveReports && (rpt.approvalStatus || rpt.status) !== 'Approved' && (rpt.approvalStatus || rpt.status) !== 'Rejected' && (
                          <>
                            <button onClick={() => { setApprovalModal({ type: 'approve', report: rpt }); setApprovalRemarks(''); }}
                              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition ${isDark?"bg-emerald-900/40 text-emerald-300 border-emerald-700 hover:bg-emerald-800/60":"bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}>
                              <ThumbsUp className="w-3 h-3"/>Approve
                            </button>
                            <button onClick={() => { setApprovalModal({ type: 'reject', report: rpt }); setApprovalRemarks(''); }}
                              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition ${isDark?"bg-red-900/30 text-red-300 border-red-700 hover:bg-red-900/50":"bg-red-50 text-red-700 border-red-200 hover:bg-red-100"}`}>
                              <ThumbsDown className="w-3 h-3"/>Reject
                            </button>
                          </>
                        )}
                        {canApproveReports && ((rpt.approvalStatus || rpt.status) === 'Approved' || (rpt.approvalStatus || rpt.status) === 'Rejected') && (
                          <span className={`text-[10px] font-semibold ${isDark?'text-slate-500':'text-slate-400'}`}>Action taken</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selectedReport&&<ReportDetailModal report={selectedReport} isDark={isDark} onClose={()=>setSelectedReport(null)}/>}

      {/* Approval / Rejection Confirmation Modal */}
      {approvalModal && (
        <div style={{ position:'fixed', inset:0, zIndex:999999, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', background:'rgba(15,23,42,0.75)', backdropFilter:'blur(6px)' }}>
          <div onClick={() => setApprovalModal(null)} style={{ position:'absolute', inset:0 }} />
          <div style={{
            position:'relative', width:'100%', maxWidth:480,
            background: isDark ? '#0f1b30' : '#ffffff',
            borderRadius:20, boxShadow:'0 25px 50px rgba(0,0,0,0.4)',
            border: isDark ? '1px solid #1f3358' : '1px solid #e2e8f0',
            padding:28, zIndex:1
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{
                width:44, height:44, borderRadius:12,
                background: approvalModal.type === 'approve' ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
                display:'flex', alignItems:'center', justifyContent:'center'
              }}>
                {approvalModal.type === 'approve' ? <ThumbsUp size={22} color="#fff"/> : <ThumbsDown size={22} color="#fff"/>}
              </div>
              <div>
                <div style={{ fontSize:'1.1rem', fontWeight:800, color: isDark?'#f1f5f9':'#0f172a' }}>
                  {approvalModal.type === 'approve' ? 'Approve Report' : 'Reject Report'}
                </div>
                <div style={{ fontSize:'0.78rem', color:'#64748b', marginTop:2 }}>
                  {approvalModal.report.reportNumber} · {approvalModal.report.managerName}
                </div>
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:'0.8rem', fontWeight:700, color: isDark?'#94a3b8':'#64748b', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                <MessageSquare size={13}/>
                {approvalModal.type === 'approve' ? 'Remarks (Optional)' : 'Rejection Reason (Required)'}
              </div>
              <textarea
                value={approvalRemarks}
                onChange={e => setApprovalRemarks(e.target.value)}
                placeholder={approvalModal.type === 'approve' ? 'Add optional remarks...' : 'Explain why this report is being rejected...'}
                rows={3}
                style={{
                  width:'100%', padding:'10px 12px', borderRadius:10,
                  border: isDark ? '1px solid #1f3358' : '1px solid #e2e8f0',
                  background: isDark ? '#0a1628' : '#f8fafc',
                  color: isDark ? '#e2e8f0' : '#0f172a',
                  fontSize:'0.82rem', resize:'vertical', outline:'none',
                  boxSizing:'border-box'
                }}
              />
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setApprovalModal(null)}
                style={{
                  padding:'9px 20px', borderRadius:9,
                  border: isDark?'1px solid #1f3358':'1px solid #e2e8f0',
                  background:'transparent', color: isDark?'#94a3b8':'#64748b',
                  fontSize:'0.84rem', fontWeight:700, cursor:'pointer'
                }}>Cancel</button>
              <button
                onClick={approvalModal.type === 'approve' ? handleApprove : handleReject}
                disabled={approvalLoading}
                style={{
                  padding:'9px 24px', borderRadius:9, border:'none',
                  background: approvalModal.type === 'approve'
                    ? 'linear-gradient(135deg,#059669,#047857)'
                    : 'linear-gradient(135deg,#dc2626,#b91c1c)',
                  color:'#ffffff', fontSize:'0.84rem', fontWeight:700,
                  cursor: approvalLoading ? 'not-allowed' : 'pointer',
                  opacity: approvalLoading ? 0.7 : 1,
                  display:'flex', alignItems:'center', gap:6
                }}>
                {approvalLoading ? 'Processing...' : (approvalModal.type === 'approve' ? '✓ Confirm Approve' : '✕ Confirm Reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {approvalToast && (
        <div style={{
          position:'fixed', bottom:24, right:24, zIndex:9999999,
          padding:'12px 20px', borderRadius:12,
          background: approvalToast.type === 'success' ? '#059669' : '#dc2626',
          color:'#ffffff', fontWeight:700, fontSize:'0.85rem',
          boxShadow:'0 8px 24px rgba(0,0,0,0.25)',
          display:'flex', alignItems:'center', gap:8,
          animation:'slideIn 0.3s ease'
        }}>
          {approvalToast.type === 'success' ? <CheckCircle size={16}/> : <XCircle size={16}/>}
          {approvalToast.msg}
        </div>
      )}
    </div>
  );
}
