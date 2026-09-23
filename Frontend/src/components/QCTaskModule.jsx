import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SearchBar } from './SearchBar';
import {
  AlertTriangle, ClipboardList, Plus, Eye, CheckCircle, XCircle,
  Clock, Play, Pause, RotateCcw, Send, X, ChevronDown, ChevronUp,
  MapPin, Calendar, User, Tag, Layers, Flag, FileText, Camera,
  MessageSquare, Shield, ThumbsUp, ThumbsDown, Loader2, RefreshCw,
  Building2, Navigation, Search, Filter, ArrowRight, Check, AlertCircle,
  Archive, Info, Download
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const ISSUE_TYPES = [
  'Road Damage', 'Water Supply Issue', 'Electricity Problem', 'Sanitation Issue',
  'Drainage Problem', 'Street Light Failure', 'Vendor Compliance', 'Property Tax Issue',
  'Encroachment', 'Public Safety', 'Environmental Violation', 'Infrastructure Damage', 'Other'
];

const PRIORITIES = ['High', 'Medium', 'Low'];
const TASK_CATEGORIES = [
  'Field Inspection', 'Vendor Onboarding', 'KYC Verification', 'Infrastructure',
  'Compliance', 'Community Outreach', 'Data Collection', 'Maintenance', 'General'
];

const STATUS_CONFIG = {
  'Raised':             { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', icon: AlertCircle },
  'Assigned':           { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)', icon: User },
  'Resolved':           { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', icon: CheckCircle },
  'Closed':             { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)', icon: Archive },
  'Pending Acceptance': { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: Clock },
  'Accepted':           { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', icon: Check },
  'In Progress':        { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', icon: Play },
  'Completed':          { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', icon: CheckCircle },
  'Suspend Requested':  { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', icon: Pause },
  'Suspended':          { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', icon: XCircle },
  'Rework Required':    { color: '#dc2626', bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.3)', icon: RotateCcw },
};

const PRIORITY_CONFIG = {
  High:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: '🔴 High' },
  Medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '🟡 Medium' },
  Low:    { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: '🟢 Low' },
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

function userRoleGroup(user) {
  const r = (user?.role || '').toLowerCase();
  if (r.includes('qc')) return 'qc';
  if (r.includes('manager')) return 'manager';
  if (r.includes('admin') || r.includes('super')) return 'admin';
  return 'other';
}

function fmtDate(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dt; }
}

function fmtDateOnly(dt) {
  if (!dt) return '—';
  try { return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return dt; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status, size = 'sm' }) {
  const cfg = STATUS_CONFIG[status] || { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)', icon: Info };
  const Icon = cfg.icon;
  const pad = size === 'sm' ? '3px 8px' : '5px 12px';
  const fSize = size === 'sm' ? '0.72rem' : '0.82rem';
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:pad, borderRadius:20, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, fontSize:fSize, fontWeight:700, whiteSpace:'nowrap' }}>
      <Icon size={size === 'sm' ? 11 : 13} />
      {status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Medium;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:20, background:cfg.bg, color:cfg.color, fontSize:'0.72rem', fontWeight:700, border:`1px solid ${cfg.color}30` }}>
      <Flag size={10} />{priority}
    </span>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return createPortal(
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999999, padding:'12px 20px', borderRadius:12, background:toast.type==='success'?'#059669':'#dc2626', color:'#fff', fontWeight:700, fontSize:'0.85rem', boxShadow:'0 8px 24px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:8 }}>
      {toast.type === 'success' ? <CheckCircle size={16}/> : <XCircle size={16}/>}
      {toast.msg}
    </div>,
    document.body
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function ModalShell({ onClose, isDark, children, title, icon: Icon, iconBg }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'rgba(10, 22, 40, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}
    >
      <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} />
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 620,
          maxHeight: 'min(90vh, 760px)',
          overflowY: 'auto',
          borderRadius: 20,
          background: isDark ? '#0a1628' : '#ffffff',
          border: isDark ? '1px solid #1a2d4a' : '1px solid #e2e8f0',
          boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
          padding: '28px 28px 24px',
          zIndex: 10,
          margin: 'auto'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: iconBg || 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {Icon && <Icon size={22} color="#fff" />}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a' }}>{title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? '#64748b' : '#94a3b8', padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function Field({ label, isDark, children, required }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:'0.78rem', fontWeight:700, color:isDark?'#94a3b8':'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>
        {label}{required && <span style={{ color:'#ef4444', marginLeft:3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ isDark, ...props }) {
  const base = { width:'100%', padding:'9px 12px', borderRadius:10, border:isDark?'1px solid #1a2d4a':'1px solid #e2e8f0', background:isDark?'#060e1c':'#f8fafc', color:isDark?'#e2e8f0':'#0f172a', fontSize:'0.84rem', outline:'none', boxSizing:'border-box' };
  return <input style={base} {...props}/>;
}

function Textarea({ isDark, rows=3, ...props }) {
  const base = { width:'100%', padding:'9px 12px', borderRadius:10, border:isDark?'1px solid #1a2d4a':'1px solid #e2e8f0', background:isDark?'#060e1c':'#f8fafc', color:isDark?'#e2e8f0':'#0f172a', fontSize:'0.84rem', outline:'none', resize:'vertical', boxSizing:'border-box' };
  return <textarea rows={rows} style={base} {...props}/>;
}

function Select({ isDark, children, ...props }) {
  const base = { width:'100%', padding:'9px 12px', borderRadius:10, border:isDark?'1px solid #1a2d4a':'1px solid #e2e8f0', background:isDark?'#060e1c':'#f8fafc', color:isDark?'#e2e8f0':'#0f172a', fontSize:'0.84rem', outline:'none', boxSizing:'border-box' };
  return <select style={base} {...props}>{children}</select>;
}

function Btn({ onClick, disabled, children, variant='primary', style={} }) {
  const colors = {
    primary: { bg:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff' },
    success: { bg:'linear-gradient(135deg,#059669,#047857)', color:'#fff' },
    danger:  { bg:'linear-gradient(135deg,#dc2626,#b91c1c)', color:'#fff' },
    ghost:   { bg:'transparent', color:'#6366f1', border:'1.5px solid #6366f1' },
    warning: { bg:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff' },
    neutral: { bg:'transparent', color:'#64748b', border:'1.5px solid #e2e8f0' }
  };
  const v = colors[variant] || colors.primary;
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding:'9px 20px', borderRadius:10, border:v.border||'none', background:v.bg, color:v.color, fontSize:'0.84rem', fontWeight:700, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.6:1, display:'inline-flex', alignItems:'center', gap:6, ...style }}>
      {children}
    </button>
  );
}

// ─── Raise Issue Modal ────────────────────────────────────────────────────────

function RaiseIssueModal({ isDark, onClose, onSuccess }) {
  const [form, setForm] = useState({ issueType:'', description:'', state:'', district:'', division:'', pincode:'', location:'', priority:'Medium', remarks:'' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.issueType || !form.description) { setErr('Issue Type and Description are required.'); return; }
    setLoading(true); setErr('');
    try {
      const res = await dataService.raiseQCIssue(form);
      if (res.success) { onSuccess(res.message); onClose(); }
      else setErr(res.message || 'Failed to raise issue.');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <ModalShell onClose={onClose} isDark={isDark} title="Raise QC Issue" icon={AlertTriangle} iconBg="linear-gradient(135deg,#f59e0b,#d97706)">
      {err && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', padding:'10px 14px', borderRadius:10, marginBottom:16, fontSize:'0.83rem' }}>{err}</div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Field label="Issue Type" isDark={isDark} required>
          <Select isDark={isDark} value={form.issueType} onChange={e=>set('issueType',e.target.value)}>
            <option value="">Select type…</option>
            {ISSUE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Priority" isDark={isDark} required>
          <Select isDark={isDark} value={form.priority} onChange={e=>set('priority',e.target.value)}>
            {PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Description" isDark={isDark} required>
        <Textarea isDark={isDark} rows={3} placeholder="Describe the issue in detail…" value={form.description} onChange={e=>set('description',e.target.value)}/>
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Field label="State" isDark={isDark}><Input isDark={isDark} placeholder="State" value={form.state} onChange={e=>set('state',e.target.value)}/></Field>
        <Field label="District" isDark={isDark}><Input isDark={isDark} placeholder="District" value={form.district} onChange={e=>set('district',e.target.value)}/></Field>
        <Field label="Division" isDark={isDark}><Input isDark={isDark} placeholder="Division" value={form.division} onChange={e=>set('division',e.target.value)}/></Field>
        <Field label="Pincode" isDark={isDark}><Input isDark={isDark} placeholder="Pincode" value={form.pincode} onChange={e=>set('pincode',e.target.value)}/></Field>
      </div>
      <Field label="Location / Landmark" isDark={isDark}><Input isDark={isDark} placeholder="Specific location or landmark" value={form.location} onChange={e=>set('location',e.target.value)}/></Field>
      <Field label="Remarks" isDark={isDark}><Textarea isDark={isDark} rows={2} placeholder="Any additional remarks…" value={form.remarks} onChange={e=>set('remarks',e.target.value)}/></Field>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="neutral" onClick={onClose}>Cancel</Btn>
        <Btn variant="warning" onClick={submit} disabled={loading}><Send size={14}/>{loading?'Submitting…':'Raise Issue'}</Btn>
      </div>
    </ModalShell>
  );
}

// ─── Create Task Modal ────────────────────────────────────────────────────────

function CreateTaskModal({ isDark, onClose, onSuccess, linkedIssue }) {
  const [form, setForm] = useState({
    title:'', description:'', category:'General', priority: linkedIssue?.priority || 'Medium',
    dueDate:'', assignedManagerId:'', qcIssueId: linkedIssue?._id || linkedIssue?.id || '',
    state: linkedIssue?.state||'', district: linkedIssue?.district||'',
    division: linkedIssue?.division||'', pincode: linkedIssue?.pincode||'',
    location: linkedIssue?.location||'', remarks:''
  });
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMgrs, setLoadingMgrs] = useState(true);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    dataService.getQCTaskManagers().then(r => { if (r.success) setManagers(r.data || []); }).catch(() => {}).finally(()=>setLoadingMgrs(false));
  }, []);

  const submit = async () => {
    if (!form.title || !form.assignedManagerId) { setErr('Task title and assigned manager are required.'); return; }
    setLoading(true); setErr('');
    try {
      const res = await dataService.createQCTask(form);
      if (res.success) { onSuccess(res.message); onClose(); }
      else setErr(res.message || 'Failed to create task.');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <ModalShell onClose={onClose} isDark={isDark} title={linkedIssue ? `Create Task from Issue #${linkedIssue.issueNumber}` : 'Create New Task'} icon={ClipboardList} iconBg="linear-gradient(135deg,#6366f1,#4f46e5)">
      {linkedIssue && (
        <div style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:'0.8rem', color:'#a5b4fc' }}>
          <strong>Linked Issue:</strong> {linkedIssue.issueNumber} — {linkedIssue.issueType} | {linkedIssue.description?.slice(0,80)}…
        </div>
      )}
      {err && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', padding:'10px 14px', borderRadius:10, marginBottom:16, fontSize:'0.83rem' }}>{err}</div>}
      <Field label="Task Title" isDark={isDark} required>
        <Input isDark={isDark} placeholder="Enter task title…" value={form.title} onChange={e=>set('title',e.target.value)}/>
      </Field>
      <Field label="Description" isDark={isDark}>
        <Textarea isDark={isDark} rows={3} placeholder="Task description…" value={form.description} onChange={e=>set('description',e.target.value)}/>
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Field label="Category" isDark={isDark}>
          <Select isDark={isDark} value={form.category} onChange={e=>set('category',e.target.value)}>
            {TASK_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Priority" isDark={isDark} required>
          <Select isDark={isDark} value={form.priority} onChange={e=>set('priority',e.target.value)}>
            {PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Due Date" isDark={isDark}>
          <Input isDark={isDark} type="date" value={form.dueDate} onChange={e=>set('dueDate',e.target.value)}/>
        </Field>
        <Field label="Assign Manager" isDark={isDark} required>
          {loadingMgrs ? <div style={{ color:'#64748b', fontSize:'0.8rem' }}>Loading managers…</div> : (
            <Select isDark={isDark} value={form.assignedManagerId} onChange={e=>set('assignedManagerId',e.target.value)}>
              <option value="">Select manager…</option>
              {managers.map(m=><option key={m.id} value={m.id}>{m.name} ({m.role}) {m.pincode?`— PIN ${m.pincode}`:m.division?`— ${m.division}`:m.district?`— ${m.district}`:''}</option>)}
            </Select>
          )}
        </Field>
      </div>
      {!linkedIssue && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Field label="District" isDark={isDark}><Input isDark={isDark} placeholder="District" value={form.district} onChange={e=>set('district',e.target.value)}/></Field>
          <Field label="Pincode" isDark={isDark}><Input isDark={isDark} placeholder="Pincode" value={form.pincode} onChange={e=>set('pincode',e.target.value)}/></Field>
        </div>
      )}
      <Field label="Remarks" isDark={isDark}><Textarea isDark={isDark} rows={2} placeholder="Any notes…" value={form.remarks} onChange={e=>set('remarks',e.target.value)}/></Field>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="neutral" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={loading}><Plus size={14}/>{loading?'Creating…':'Create Task'}</Btn>
      </div>
    </ModalShell>
  );
}

// ─── Complete Task Modal ───────────────────────────────────────────────────────

function CompleteTaskModal({ task, isDark, onClose, onSuccess }) {
  const [form, setForm] = useState({ resolutionDetails:'', workCompleted:'', remarks:'' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const submit = async () => {
    if (!form.resolutionDetails || !form.workCompleted) { setErr('Resolution details and work completed are required.'); return; }
    setLoading(true); setErr('');
    try {
      const res = await dataService.updateQCTaskStatus(task._id || task.id, { action:'complete', ...form });
      if (res.success) { onSuccess('Task marked as Completed!'); onClose(); }
      else setErr(res.message);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <ModalShell onClose={onClose} isDark={isDark} title="Complete Task" icon={CheckCircle} iconBg="linear-gradient(135deg,#059669,#047857)">
      <div style={{ fontSize:'0.82rem', color:isDark?'#94a3b8':'#64748b', marginBottom:16 }}>Task: <strong style={{ color:isDark?'#f1f5f9':'#0f172a' }}>{task.title}</strong></div>
      {err && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', padding:'10px 14px', borderRadius:10, marginBottom:16, fontSize:'0.83rem' }}>{err}</div>}
      <Field label="Resolution Details" isDark={isDark} required>
        <Textarea isDark={isDark} rows={3} placeholder="Describe how the issue was resolved…" value={form.resolutionDetails} onChange={e=>set('resolutionDetails',e.target.value)}/>
      </Field>
      <Field label="Work Completed" isDark={isDark} required>
        <Textarea isDark={isDark} rows={2} placeholder="What work was done?" value={form.workCompleted} onChange={e=>set('workCompleted',e.target.value)}/>
      </Field>
      <Field label="Remarks" isDark={isDark}>
        <Textarea isDark={isDark} rows={2} placeholder="Any additional remarks…" value={form.remarks} onChange={e=>set('remarks',e.target.value)}/>
      </Field>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="neutral" onClick={onClose}>Cancel</Btn>
        <Btn variant="success" onClick={submit} disabled={loading}><CheckCircle size={14}/>{loading?'Saving…':'Confirm Complete'}</Btn>
      </div>
    </ModalShell>
  );
}

// ─── Suspend Request Modal ─────────────────────────────────────────────────────

function SuspendModal({ task, isDark, onClose, onSuccess }) {
  const [form, setForm] = useState({ suspendReason:'', explanation:'', remarks:'' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const submit = async () => {
    if (!form.suspendReason || !form.explanation) { setErr('Suspend reason and explanation are required.'); return; }
    setLoading(true); setErr('');
    try {
      const res = await dataService.submitSuspendRequest(task._id || task.id, form);
      if (res.success) { onSuccess('Suspend request submitted — awaiting admin review.'); onClose(); }
      else setErr(res.message);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <ModalShell onClose={onClose} isDark={isDark} title="Request Task Suspension" icon={Pause} iconBg="linear-gradient(135deg,#f97316,#ea580c)">
      <div style={{ fontSize:'0.82rem', color:isDark?'#94a3b8':'#64748b', marginBottom:16 }}>Task: <strong style={{ color:isDark?'#f1f5f9':'#0f172a' }}>{task.title}</strong></div>
      {err && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', padding:'10px 14px', borderRadius:10, marginBottom:16, fontSize:'0.83rem' }}>{err}</div>}
      <Field label="Suspend Reason" isDark={isDark} required>
        <Select isDark={isDark} value={form.suspendReason} onChange={e=>set('suspendReason',e.target.value)}>
          <option value="">Select reason…</option>
          {['Insufficient Resources','Weather Conditions','Access Denied','Technical Issue','Awaiting Third Party','Force Majeure','Other'].map(r=><option key={r} value={r}>{r}</option>)}
        </Select>
      </Field>
      <Field label="Detailed Explanation" isDark={isDark} required>
        <Textarea isDark={isDark} rows={4} placeholder="Explain why the task cannot be completed right now…" value={form.explanation} onChange={e=>set('explanation',e.target.value)}/>
      </Field>
      <Field label="Remarks" isDark={isDark}>
        <Textarea isDark={isDark} rows={2} placeholder="Any additional notes…" value={form.remarks} onChange={e=>set('remarks',e.target.value)}/>
      </Field>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="neutral" onClick={onClose}>Cancel</Btn>
        <Btn variant="warning" onClick={submit} disabled={loading}><Pause size={14}/>{loading?'Submitting…':'Submit Suspend Request'}</Btn>
      </div>
    </ModalShell>
  );
}

// ─── Suspend Review Modal (Admin) ──────────────────────────────────────────────

function SuspendReviewModal({ task, isDark, onClose, onSuccess }) {
  const [adminRemarks, setAdminRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const sr = task.suspendRequest || {};

  const decide = async (decision) => {
    setLoading(true); setErr('');
    try {
      const res = await dataService.reviewSuspendRequest(task._id || task.id, { decision, adminRemarks });
      if (res.success) { onSuccess(decision === 'approve' ? 'Suspend approved — task suspended.' : 'Suspend rejected — rework required.'); onClose(); }
      else setErr(res.message);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <ModalShell onClose={onClose} isDark={isDark} title="Review Suspend Request" icon={Shield} iconBg="linear-gradient(135deg,#8b5cf6,#7c3aed)">
      <div style={{ background:isDark?'rgba(249,115,22,0.08)':'rgba(249,115,22,0.05)', border:'1px solid rgba(249,115,22,0.25)', borderRadius:12, padding:'16px', marginBottom:20 }}>
        <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#f97316', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Manager's Suspend Request</div>
        <div style={{ fontSize:'0.84rem', color:isDark?'#e2e8f0':'#1e293b', marginBottom:6 }}><strong>Task:</strong> {task.title}</div>
        <div style={{ fontSize:'0.84rem', color:isDark?'#e2e8f0':'#1e293b', marginBottom:6 }}><strong>Manager:</strong> {task.assignedManagerName}</div>
        <div style={{ fontSize:'0.84rem', color:isDark?'#e2e8f0':'#1e293b', marginBottom:6 }}><strong>Reason:</strong> {sr.suspendReason}</div>
        <div style={{ fontSize:'0.84rem', color:isDark?'#e2e8f0':'#1e293b', marginBottom:4 }}><strong>Explanation:</strong></div>
        <div style={{ fontSize:'0.83rem', color:isDark?'#94a3b8':'#64748b', background:isDark?'rgba(0,0,0,0.2)':'rgba(0,0,0,0.04)', borderRadius:8, padding:'8px 12px' }}>{sr.explanation}</div>
        <div style={{ fontSize:'0.75rem', color:isDark?'#64748b':'#94a3b8', marginTop:8 }}>Requested at: {fmtDate(sr.requestedAt)}</div>
      </div>
      {err && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', padding:'10px 14px', borderRadius:10, marginBottom:16, fontSize:'0.83rem' }}>{err}</div>}
      <Field label="Admin Remarks" isDark={isDark}>
        <Textarea isDark={isDark} rows={3} placeholder="Enter your decision remarks…" value={adminRemarks} onChange={e=>setAdminRemarks(e.target.value)}/>
      </Field>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="neutral" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={()=>decide('reject')} disabled={loading}><ThumbsDown size={14}/>{loading?'…':'Reject — Rework Required'}</Btn>
        <Btn variant="success" onClick={()=>decide('approve')} disabled={loading}><ThumbsUp size={14}/>{loading?'…':'Approve Suspend'}</Btn>
      </div>
    </ModalShell>
  );
}

// ─── Task Detail Modal ─────────────────────────────────────────────────────────

function TaskDetailModal({ task, isDark, onClose, onReview, isAdmin }) {
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleReview = async (decision) => {
    setLoading(true);
    setErr('');
    try {
      if (onReview) {
        await onReview(decision, task, remarks);
      }
      onClose();
    } catch (e) {
      setErr(e.message || 'Review failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} isDark={isDark} title={`Task: ${task.taskNumber}`} icon={ClipboardList} iconBg="linear-gradient(135deg,#6366f1,#4f46e5)">
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {[['Status', <StatusBadge status={task.status}/>], ['Priority', <PriorityBadge priority={task.priority}/>], ['Category', task.category], ['Due Date', fmtDateOnly(task.dueDate)], ['Assigned Manager', task.assignedManagerName], ['Manager Role', task.assignedManagerRole], ['Created By', task.createdByAdminName], ['Created At', fmtDate(task.createdAt)]].map(([label, val], i) => (
          <div key={i}>
            <div style={{ fontSize:'0.72rem', fontWeight:700, color:isDark?'#64748b':'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:'0.84rem', color:isDark?'#e2e8f0':'#0f172a', fontWeight:600 }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:'0.72rem', fontWeight:700, color:isDark?'#64748b':'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Description</div>
        <div style={{ fontSize:'0.84rem', color:isDark?'#94a3b8':'#64748b' }}>{task.description || '—'}</div>
      </div>
      {task.completionDetails && (
        <div style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:10, padding:14, marginBottom:12 }}>
          <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#10b981', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            <CheckCircle size={14}/> Completion Details
          </div>
          {task.completionDetails.resolutionDetails && (
            <div style={{ fontSize:'0.83rem', color:isDark?'#e2e8f0':'#1e293b' }}><strong>Resolution:</strong> {task.completionDetails.resolutionDetails}</div>
          )}
          <div style={{ fontSize:'0.83rem', color:isDark?'#e2e8f0':'#1e293b', marginTop:4 }}><strong>Work Done:</strong> {task.completionDetails.workCompleted || 'Deliverable completed on field'}</div>
          {task.completionDetails.remarks && (
            <div style={{ fontSize:'0.83rem', color:isDark?'#94a3b8':'#64748b', marginTop:4 }}><strong>Manager Remarks:</strong> {task.completionDetails.remarks}</div>
          )}
          <div style={{ fontSize:'0.75rem', color:isDark?'#64748b':'#94a3b8', marginTop:4 }}>Completed: {fmtDate(task.completionDetails.completedAt)} by {task.completionDetails.completedBy || task.assignedManagerName}</div>
        </div>
      )}
      {task.adminReview && (
        <div style={{ background:task.adminReview.decision==='Accepted'?'rgba(16,185,129,0.08)':'rgba(239,68,68,0.08)', border:`1px solid ${task.adminReview.decision==='Accepted'?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.25)'}`, borderRadius:10, padding:12, marginBottom:12 }}>
          <div style={{ fontSize:'0.78rem', fontWeight:700, color:task.adminReview.decision==='Accepted'?'#10b981':'#ef4444', marginBottom:4 }}>
            Admin Review: {task.adminReview.decision}
          </div>
          <div style={{ fontSize:'0.83rem', color:isDark?'#e2e8f0':'#1e293b' }}>{task.adminReview.remarks || 'No remarks provided'}</div>
          <div style={{ fontSize:'0.74rem', color:isDark?'#64748b':'#94a3b8', marginTop:4 }}>Reviewed by {task.adminReview.reviewedBy} at {fmtDate(task.adminReview.reviewedAt)}</div>
        </div>
      )}
      {task.suspendRequest && (
        <div style={{ background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.25)', borderRadius:10, padding:14, marginBottom:12 }}>
          <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#f97316', marginBottom:8 }}>⏸ Suspend Request</div>
          <div style={{ fontSize:'0.83rem', color:isDark?'#e2e8f0':'#1e293b' }}><strong>Reason:</strong> {task.suspendRequest.suspendReason}</div>
          <div style={{ fontSize:'0.83rem', color:isDark?'#e2e8f0':'#1e293b', marginTop:4 }}>{task.suspendRequest.explanation}</div>
          {task.suspendRequest.adminDecision && (
            <div style={{ marginTop:8, fontSize:'0.83rem', color: task.suspendRequest.adminDecision==='Approved'?'#10b981':'#ef4444' }}>
              Admin Decision: <strong>{task.suspendRequest.adminDecision}</strong> — {task.suspendRequest.adminRemarks}
            </div>
          )}
        </div>
      )}
      {/* Activity Log */}
      {(task.activityLog || []).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize:'0.78rem', fontWeight:700, color:isDark?'#64748b':'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Activity Log</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:150, overflowY:'auto' }}>
            {[...(task.activityLog||[])].reverse().map((log, i) => (
              <div key={i} style={{ display:'flex', gap:10, fontSize:'0.8rem' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#6366f1', marginTop:5, flexShrink:0 }}/>
                <div>
                  <span style={{ fontWeight:700, color:isDark?'#a5b4fc':'#6366f1' }}>{log.action}</span>
                  <span style={{ color:isDark?'#64748b':'#94a3b8', marginLeft:6 }}>by {log.by}</span>
                  <div style={{ color:isDark?'#475569':'#94a3b8', fontSize:'0.74rem' }}>{fmtDate(log.at)}{log.notes?' — '+log.notes:''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Actions when Completed and Admin */}
      {isAdmin && task.status === 'Completed' && onReview && (
        <div style={{ borderTop: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', paddingTop: 14, marginTop: 12 }}>
          {err && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', padding:'8px 12px', borderRadius:8, marginBottom:12, fontSize:'0.8rem' }}>{err}</div>}
          <Field label="Admin Decision Remarks" isDark={isDark}>
            <Textarea isDark={isDark} rows={2} placeholder="Enter remarks (reason for rework, or note of acceptance)…" value={remarks} onChange={e=>setRemarks(e.target.value)}/>
          </Field>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop: 12 }}>
            <Btn variant="neutral" onClick={onClose}>Close</Btn>
            <Btn variant="danger" onClick={()=>handleReview('rework')} disabled={loading}>
              <RotateCcw size={14}/>{loading ? '…' : 'Rework'}
            </Btn>
            <Btn variant="success" onClick={()=>handleReview('accept')} disabled={loading}>
              <CheckCircle size={14}/>{loading ? '…' : 'Accepted'}
            </Btn>
          </div>
        </div>
      )}

      {!(isAdmin && task.status === 'Completed' && onReview) && (
        <div style={{ borderTop: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', paddingTop: 14, marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="neutral" onClick={onClose}>Close</Btn>
        </div>
      )}
    </ModalShell>
  );
}

// ─── Issue Detail Modal ────────────────────────────────────────────────────────

function IssueDetailModal({ issue, isDark, onClose, onCreateTask, onReview, tasks = [], isAdmin }) {
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Lookup linked task
  const linkedTask = (tasks || []).find(t =>
    (t.qcIssueId && (t.qcIssueId === issue._id || t.qcIssueId === issue.id)) ||
    (issue.taskId && (t._id === issue.taskId || t.id === issue.taskId))
  );

  const isResolvedOrCompleted = issue.status === 'Resolved' || linkedTask?.status === 'Completed';

  const handleReview = async (decision) => {
    setLoading(true);
    setErr('');
    try {
      if (onReview) {
        await onReview(decision, issue, remarks);
      }
      onClose();
    } catch (e) {
      setErr(e.message || 'Review failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} isDark={isDark} title={`Issue: ${issue.issueNumber}`} icon={AlertTriangle} iconBg="linear-gradient(135deg,#f59e0b,#d97706)">
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {[['Status', <StatusBadge status={issue.status}/>], ['Priority', <PriorityBadge priority={issue.priority}/>], ['Issue Type', issue.issueType], ['Raised By', issue.raisedBy], ['District', issue.district||'—'], ['Division', issue.division||'—'], ['Pincode', issue.pincode||'—'], ['Raised At', fmtDate(issue.raisedAt)]].map(([label, val], i) => (
          <div key={i}>
            <div style={{ fontSize:'0.72rem', fontWeight:700, color:isDark?'#64748b':'#94a3b8', textTransform:'uppercase', marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:'0.84rem', color:isDark?'#e2e8f0':'#0f172a', fontWeight:600 }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:'0.72rem', fontWeight:700, color:isDark?'#64748b':'#94a3b8', textTransform:'uppercase', marginBottom:6 }}>Description</div>
        <div style={{ fontSize:'0.84rem', color:isDark?'#94a3b8':'#64748b' }}>{issue.description}</div>
      </div>
      {issue.location && (
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:'0.72rem', fontWeight:700, color:isDark?'#64748b':'#94a3b8', textTransform:'uppercase', marginBottom:4 }}>Location</div>
          <div style={{ fontSize:'0.84rem', color:isDark?'#94a3b8':'#64748b' }}>{issue.location}</div>
        </div>
      )}
      {issue.remarks && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:'0.72rem', fontWeight:700, color:isDark?'#64748b':'#94a3b8', textTransform:'uppercase', marginBottom:4 }}>Remarks</div>
          <div style={{ fontSize:'0.84rem', color:isDark?'#94a3b8':'#64748b' }}>{issue.remarks}</div>
        </div>
      )}

      {/* Linked Task & Completion Details */}
      {linkedTask && (
        <div style={{ background: isResolvedOrCompleted ? 'rgba(16,185,129,0.08)' : (isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)'), border: `1px solid ${isResolvedOrCompleted ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.25)'}`, borderRadius:12, padding:14, marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontSize:'0.78rem', fontWeight:700, color: isResolvedOrCompleted ? '#10b981' : '#6366f1', display:'flex', alignItems:'center', gap:6 }}>
              {isResolvedOrCompleted ? <CheckCircle size={14}/> : <ClipboardList size={14}/>}
              {isResolvedOrCompleted ? 'Field Deliverable Completed' : 'Linked Field Task'}
            </div>
            <span style={{ fontSize:'0.72rem', color:isDark?'#94a3b8':'#64748b', fontFamily:'monospace', fontWeight:600 }}>
              {linkedTask.taskNumber}
            </span>
          </div>
          <div style={{ fontSize:'0.82rem', color:isDark?'#e2e8f0':'#1e293b', marginBottom:4 }}>
            <strong>Assigned Manager:</strong> {linkedTask.assignedManagerName} ({linkedTask.assignedManagerRole || 'Field Manager'})
          </div>
          {linkedTask.completionDetails?.workCompleted && (
            <div style={{ fontSize:'0.82rem', color:isDark?'#cbd5e1':'#334155', marginBottom:4 }}>
              <strong>Work Done:</strong> {linkedTask.completionDetails.workCompleted}
            </div>
          )}
          {linkedTask.completionDetails?.completedAt && (
            <div style={{ fontSize:'0.74rem', color:isDark?'#64748b':'#94a3b8' }}>
              Completed: {fmtDate(linkedTask.completionDetails.completedAt)} by {linkedTask.completionDetails.completedBy || linkedTask.assignedManagerName}
            </div>
          )}
        </div>
      )}

      {/* Admin Review Result if already reviewed */}
      {issue.adminReview && (
        <div style={{ background:issue.adminReview.decision==='Accepted'?'rgba(16,185,129,0.08)':'rgba(239,68,68,0.08)', border:`1px solid ${issue.adminReview.decision==='Accepted'?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.25)'}`, borderRadius:10, padding:12, marginBottom:14 }}>
          <div style={{ fontSize:'0.78rem', fontWeight:700, color:issue.adminReview.decision==='Accepted'?'#10b981':'#ef4444', marginBottom:4 }}>
            Admin Review: {issue.adminReview.decision}
          </div>
          <div style={{ fontSize:'0.83rem', color:isDark?'#e2e8f0':'#1e293b' }}>{issue.adminReview.remarks || 'No remarks provided'}</div>
          <div style={{ fontSize:'0.74rem', color:isDark?'#64748b':'#94a3b8', marginTop:4 }}>Reviewed by {issue.adminReview.reviewedBy} at {fmtDate(issue.adminReview.reviewedAt)}</div>
        </div>
      )}

      {/* Create Task Button (for unresolved issues) */}
      {onCreateTask && !['Assigned','Resolved','Closed'].includes(issue.status) && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
          <Btn variant="primary" onClick={()=>onCreateTask(issue)}><Plus size={14}/>Create Task from this Issue</Btn>
        </div>
      )}

      {/* Admin Decision: Rework and Accepted buttons for Resolved / Completed place */}
      {isAdmin && isResolvedOrCompleted && issue.status !== 'Closed' && (
        <div style={{ borderTop: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', paddingTop: 14, marginTop: 14 }}>
          {err && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', padding:'8px 12px', borderRadius:8, marginBottom:12, fontSize:'0.8rem' }}>{err}</div>}
          <Field label="Admin Decision Remarks" isDark={isDark}>
            <Textarea isDark={isDark} rows={2} placeholder="Enter decision remarks (e.g. rework instructions, or acceptance notes)…" value={remarks} onChange={e=>setRemarks(e.target.value)}/>
          </Field>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop: 12 }}>
            <Btn variant="neutral" onClick={onClose}>Close</Btn>
            <Btn variant="danger" onClick={()=>handleReview('rework')} disabled={loading}>
              <RotateCcw size={14}/>{loading ? '…' : 'Rework'}
            </Btn>
            <Btn variant="success" onClick={()=>handleReview('accept')} disabled={loading}>
              <CheckCircle size={14}/>{loading ? '…' : 'Accepted'}
            </Btn>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ─── Issues Table ─────────────────────────────────────────────────────────────

function IssuesTable({ isDark, issues, onView, onCreateTask, isAdmin: admin, onReviewIssue }) {
  if (issues.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400">
        <div className="text-sm font-medium">No records found</div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting your search or filters.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 select-none">
          <tr>
            <th className="px-4 py-3 font-semibold">Issue ID</th>
            <th className="px-4 py-3 font-semibold">Type & Details</th>
            <th className="px-4 py-3 font-semibold">Location</th>
            <th className="px-4 py-3 font-semibold">Priority</th>
            <th className="px-4 py-3 font-semibold">Reported By</th>
            <th className="px-4 py-3 font-semibold">Date</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
          {issues.map(issue => (
            <tr
              key={issue._id || issue.id}
              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
            >
              <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-blue-600 dark:text-cyan-300 text-xs">
                {issue.issueNumber}
              </td>
              <td className="px-4 py-3 max-w-[240px]">
                <div className="font-bold text-slate-900 dark:text-white text-xs">{issue.issueType}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {issue.description}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  {issue.district || '—'}
                </div>
                {issue.pincode && (
                  <div className="text-[10px] text-blue-600 dark:text-cyan-400 font-mono font-bold">
                    PIN: {issue.pincode}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <PriorityBadge priority={issue.priority} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-xs text-slate-800 dark:text-slate-200 font-medium">{issue.raisedBy}</div>
                <div className="text-[10px] text-slate-500">QC Team</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs">
                {fmtDateOnly(issue.raisedAt)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <StatusBadge status={issue.status} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <div className="inline-flex items-center gap-1.5 justify-end">
                  <button
                    onClick={() => onView(issue)}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer flex items-center gap-1"
                  >
                    <Eye size={12} />
                    <span>View</span>
                  </button>
                  {admin && !['Assigned', 'Resolved', 'Closed'].includes(issue.status) && (
                    <button
                      onClick={() => onCreateTask(issue)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={12} />
                      <span>Create Task</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tasks Table ──────────────────────────────────────────────────────────────

function TasksTable({ isDark, tasks, onView, onAction, roleGroup, isPincodeManager }) {
  if (tasks.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400">
        <div className="text-sm font-medium">No records found</div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 select-none">
          <tr>
            <th className="px-4 py-3 font-semibold">Task ID</th>
            <th className="px-4 py-3 font-semibold">Task Title & Details</th>
            <th className="px-4 py-3 font-semibold">Category</th>
            <th className="px-4 py-3 font-semibold">Priority</th>
            <th className="px-4 py-3 font-semibold">Assigned Manager</th>
            <th className="px-4 py-3 font-semibold">Due Date</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
          {tasks.map(task => (
            <tr
              key={task._id || task.id}
              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="font-mono font-bold text-blue-600 dark:text-cyan-300 text-xs">
                  {task.taskNumber}
                </span>
                {task.qcIssueId && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    QC Linked
                  </div>
                )}
              </td>
              <td className="px-4 py-3 max-w-[220px]">
                <div className="font-bold text-slate-900 dark:text-white text-xs">{task.title}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {task.description}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                {task.category}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <PriorityBadge priority={task.priority} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="font-bold text-slate-900 dark:text-white text-xs">
                  {task.assignedManagerName || 'Unassigned'}
                </div>
                <div className="text-[10px] text-slate-500">{task.assignedManagerRole}</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs">
                {fmtDateOnly(task.dueDate)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <StatusBadge status={task.status} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <div className="inline-flex items-center gap-1.5 justify-end flex-wrap">
                  <button
                    onClick={() => onView(task)}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer flex items-center gap-1"
                  >
                    <Eye size={12} />
                    <span>Details</span>
                  </button>

                  {/* Manager action buttons - restricted to Pincode Managers only */}
                  {roleGroup === 'manager' && isPincodeManager && task.status === 'Pending Acceptance' && (
                    <button
                      onClick={() => onAction('accept', task)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      ✓ Accept
                    </button>
                  )}
                  {roleGroup === 'manager' && isPincodeManager && ['Accepted', 'Assigned'].includes(task.status) && (
                    <button
                      onClick={() => onAction('start', task)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      ▶ Start Work
                    </button>
                  )}
                  {roleGroup === 'manager' && isPincodeManager && task.status === 'In Progress' && (
                    <>
                      <button
                        onClick={() => onAction('complete', task)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                      >
                        ✔ Complete
                      </button>
                      <button
                        onClick={() => onAction('suspend', task)}
                        className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition cursor-pointer"
                      >
                        ⏸ Suspend
                      </button>
                    </>
                  )}
                  {roleGroup === 'manager' && isPincodeManager && task.status === 'Rework Required' && (
                    <button
                      onClick={() => onAction('start', task)}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      ↩ Resume Work
                    </button>
                  )}

                  {/* Admin review suspend */}
                  {roleGroup === 'admin' && task.status === 'Suspend Requested' && (
                    <button
                      onClick={() => onAction('review_suspend', task)}
                      className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      🔍 Review Suspend
                    </button>
                  )}

                  {/* Admin review completed task — no action buttons shown for completed tasks */}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, subtext }) {
  return (
    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
        {(value || 0).toLocaleString()}
      </div>
      {subtext && (
        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
          {subtext}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QCTaskModule() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const roleGroup = userRoleGroup(user);

  const pincode = user?.pincode || '636114';
  const district = user?.district || '';
  const division = user?.division || '';
  const state = user?.state || '';

  // Data state
  const [issues, setIssues] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({});
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState(roleGroup === 'manager' ? 'tasks' : 'issues');
  const [toast, setToast] = useState(null);

  // Search / filter
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');

  // Modals
  const [raiseIssueOpen, setRaiseIssueOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [linkedIssue, setLinkedIssue] = useState(null);
  const [viewIssue, setViewIssue] = useState(null);
  const [viewTask, setViewTask] = useState(null);
  const [completeModal, setCompleteModal] = useState(null);
  const [suspendModal, setSuspendModal] = useState(null);
  const [suspendReviewModal, setSuspendReviewModal] = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadIssues = useCallback(async () => {
    setLoadingIssues(true);
    try {
      const params = {};
      if (filterStatus !== 'All') params.status = filterStatus;
      if (filterPriority !== 'All') params.priority = filterPriority;
      if (search) params.search = search;
      const res = await dataService.getQCIssues(params);
      if (res.success) setIssues(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingIssues(false);
    }
  }, [filterStatus, filterPriority, search]);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const params = {};
      if (filterStatus !== 'All') params.status = filterStatus;
      if (filterPriority !== 'All') params.priority = filterPriority;
      if (search) params.search = search;
      const res = await dataService.getQCTasks(params);
      if (res.success) {
        setTasks(res.data || []);
        setSummary(res.summary || {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTasks(false);
    }
  }, [filterStatus, filterPriority, search]);

  useEffect(() => {
    loadIssues();
    if (roleGroup !== 'qc') loadTasks();
    else setLoadingTasks(false);
  }, [loadIssues, loadTasks, roleGroup]);

  // Client-side quick filter
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      if (filterStatus !== 'All' && issue.status !== filterStatus) return false;
      if (filterPriority !== 'All' && issue.priority !== filterPriority) return false;
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        const text = `${issue.issueNumber} ${issue.issueType} ${issue.description} ${issue.district} ${issue.pincode} ${issue.raisedBy} ${issue.location}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [issues, search, filterStatus, filterPriority]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filterStatus !== 'All' && task.status !== filterStatus) return false;
      if (filterPriority !== 'All' && task.priority !== filterPriority) return false;
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        const text = `${task.taskNumber} ${task.title} ${task.description} ${task.category} ${task.assignedManagerName} ${task.assignedManagerRole}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, search, filterStatus, filterPriority]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (activeTab === 'issues') {
      if (filteredIssues.length === 0) return;
      const headers = ['Issue Number', 'Type', 'Description', 'District', 'Pincode', 'Priority', 'Status', 'Raised By', 'Raised Date'];
      const rows = filteredIssues.map(i => [
        `"${i.issueNumber || ''}"`,
        `"${(i.issueType || '').replace(/"/g, '""')}"`,
        `"${(i.description || '').replace(/"/g, '""')}"`,
        `"${i.district || ''}"`,
        `"${i.pincode || ''}"`,
        `"${i.priority || ''}"`,
        `"${i.status || ''}"`,
        `"${(i.raisedBy || '').replace(/"/g, '""')}"`,
        `"${fmtDateOnly(i.raisedAt)}"`
      ].join(','));
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csvContent));
      link.setAttribute('download', `qc_issues_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      if (filteredTasks.length === 0) return;
      const headers = ['Task Number', 'Title', 'Description', 'Category', 'Priority', 'Manager', 'Role', 'Due Date', 'Status'];
      const rows = filteredTasks.map(t => [
        `"${t.taskNumber || ''}"`,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${t.category || ''}"`,
        `"${t.priority || ''}"`,
        `"${(t.assignedManagerName || '').replace(/"/g, '""')}"`,
        `"${(t.assignedManagerRole || '').replace(/"/g, '""')}"`,
        `"${fmtDateOnly(t.dueDate)}"`,
        `"${t.status || ''}"`
      ].join(','));
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csvContent));
      link.setAttribute('download', `qc_tasks_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Admin reviews task completion (accept / rework)
  const handleReviewTask = async (decision, task, remarks = '') => {
    try {
      const res = await dataService.reviewTaskResolution(task._id || task.id, { decision, remarks });
      if (res.success) {
        showToast('success', res.message || (decision === 'accept' ? 'Task completion accepted and closed.' : 'Rework requested.'));
        loadTasks();
        loadIssues();
      } else {
        showToast('error', res.message || 'Review failed.');
      }
    } catch (e) {
      showToast('error', e.message);
    }
  };

  // Admin reviews issue resolution (accept / rework)
  const handleReviewIssue = async (decision, issue, remarks = '') => {
    try {
      const res = await dataService.reviewIssueResolution(issue._id || issue.id, { decision, remarks });
      if (res.success) {
        showToast('success', res.message || (decision === 'accept' ? 'Issue resolution accepted and closed.' : 'Rework requested.'));
        loadIssues();
        loadTasks();
      } else {
        showToast('error', res.message || 'Review failed.');
      }
    } catch (e) {
      showToast('error', e.message);
    }
  };

  // Quick status update (accept / start / review)
  const handleQuickAction = async (action, task) => {
    if (action === 'complete') { setCompleteModal(task); return; }
    if (action === 'suspend') { setSuspendModal(task); return; }
    if (action === 'review_suspend') { setSuspendReviewModal(task); return; }
    if (action === 'accept_completion') { handleReviewTask('accept', task); return; }
    if (action === 'rework') { setViewTask(task); return; }
    try {
      const res = await dataService.updateQCTaskStatus(task._id || task.id, { action });
      if (res.success) { showToast('success', res.message); loadTasks(); }
      else showToast('error', res.message || 'Action failed.');
    } catch (e) { showToast('error', e.message); }
  };

  const handleCreateTaskFromIssue = (issue) => {
    setLinkedIssue(issue);
    setCreateTaskOpen(true);
    setViewIssue(null);
  };

  // Dynamic Page Header Info (Matching Payments.jsx style)
  const isPincodeAdmin = (user?.role || '').toLowerCase().includes('pincode');
  const isDistrictAdmin = (user?.role || '').toLowerCase().includes('district');
  const isDivisionAdmin = (user?.role || '').toLowerCase().includes('divisional') || (user?.role || '').toLowerCase().includes('division');
  const isStateAdmin = (user?.role || '').toLowerCase().includes('state');

  let pageTitle = 'Pincode Task & QC Management';
  let pageSubtitle = `Review QC issues, create tasks, assign managers, and monitor progress restricted to PIN ${pincode}.`;
  let cardTitle = 'Station Tasks & QC Journal';
  let cardSubtitle = `Audit QC issues and field task assignments mapped exclusively to Pincode ${pincode}`;

  if (isDistrictAdmin) {
    pageTitle = 'District Task & QC Management';
    pageSubtitle = `Review QC issues, create tasks, assign managers and monitor progress for ${district || 'District'}.`;
    cardTitle = 'District Operations Journal';
    cardSubtitle = `Audit QC issues and field assignments mapped to ${district || 'District'}`;
  } else if (isDivisionAdmin) {
    pageTitle = 'Divisional Task & QC Management';
    pageSubtitle = `Review QC issues, create tasks, assign managers and monitor progress for ${division || 'Division'}.`;
    cardTitle = 'Divisional Operations Journal';
    cardSubtitle = `Audit QC issues and field assignments mapped to ${division || 'Division'}`;
  } else if (isStateAdmin) {
    pageTitle = 'State Task & QC Management';
    pageSubtitle = `Review QC issues, create tasks, assign managers and monitor progress across ${state || 'State'}.`;
    cardTitle = 'State Operations Journal';
    cardSubtitle = `Audit QC issues and field assignments across state operations`;
  } else if (roleGroup === 'manager') {
    pageTitle = 'My Assigned Tasks';
    pageSubtitle = 'View, accept, update, and complete tasks assigned to your queue.';
    cardTitle = 'Assigned Operations Queue';
    cardSubtitle = 'Live field tasks and deliverables assigned to your account';
  } else if (roleGroup === 'qc') {
    pageTitle = 'QC Issue Management';
    pageSubtitle = 'Raise and track quality control issues across your assigned territory.';
    cardTitle = 'QC Issues Ledger';
    cardSubtitle = 'Audit records of quality issues flagged for administrative action';
  }

  return (
    <div className="space-y-6">
      {/* ─── Page Header with Action Buttons on top right ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {pageTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {pageSubtitle}
          </p>
        </div>

        {/* Action Buttons in Page Header */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
          {roleGroup === 'admin' && activeTab === 'tasks' && (
            <button
              type="button"
              onClick={() => { setLinkedIssue(null); setCreateTaskOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          )}
          {roleGroup === 'qc' && (
            <button
              type="button"
              onClick={() => setRaiseIssueOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-600/20 transition cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Raise Issue</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCSV}
            title="Export to CSV"
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            } border text-xs font-semibold transition cursor-pointer`}
          >
            <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ─── Tabs in Left Side Corner ─── */}
      {roleGroup === 'admin' && (
        <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-0">
          <button
            type="button"
            onClick={() => { setActiveTab('issues'); setSearch(''); setFilterStatus('All'); setFilterPriority('All'); }}
            className={`pb-3 text-sm font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'issues'
                ? 'border-blue-600 text-blue-600 dark:text-cyan-400 dark:border-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>QC Issues</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'issues'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-cyan-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              {issues.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('tasks'); setSearch(''); setFilterStatus('All'); setFilterPriority('All'); }}
            className={`pb-3 text-sm font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'tasks'
                ? 'border-blue-600 text-blue-600 dark:text-cyan-400 dark:border-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Tasks</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'tasks'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-cyan-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              {tasks.length}
            </span>
          </button>
        </div>
      )}

      {/* ─── Summary Cards ─── */}
      {roleGroup !== 'qc' && Object.keys(summary).length > 0 && (
        <div className={`grid grid-cols-2 ${(summary.suspendRequested > 0 || summary.closed > 0) ? 'sm:grid-cols-3 lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3.5`}>
          <StatCard label="Total Tasks" value={summary.total || 0} icon={ClipboardList} color="text-indigo-600 dark:text-indigo-400" subtext="Assigned operations" />
          <StatCard label="Pending" value={summary.pendingAcceptance || 0} icon={Clock} color="text-amber-600 dark:text-amber-400" subtext="Awaiting manager start" />
          <StatCard label="In Progress" value={summary.inProgress || 0} icon={Play} color="text-blue-600 dark:text-blue-400" subtext="Active field execution" />
          <StatCard label="Completed" value={summary.completed || 0} icon={CheckCircle} color="text-emerald-600 dark:text-emerald-400" subtext="Finished & documented" />
          {(summary.closed || 0) > 0 ? (
            <StatCard label="Closed" value={summary.closed} icon={Archive} color="text-slate-600 dark:text-slate-400" subtext="Accepted & closed" />
          ) : (summary.suspendRequested || 0) > 0 ? (
            <StatCard label="Suspend Req." value={summary.suspendRequested} icon={Pause} color="text-rose-600 dark:text-rose-400" subtext="Needs admin decision" />
          ) : null}
        </div>
      )}

      {/* ─── Main Card / DataTable Container (Matching Payments.jsx DataTable) ─── */}
      <div className={`admin-card overflow-hidden ${
        isDark
          ? 'bg-[#131f37] border-[#1f3358] text-slate-300'
          : 'bg-white border-slate-200/90 text-slate-800 shadow-sm'
      } border rounded-2xl transition-colors`}>
        {/* Header Bar */}
        <div className={`p-4 sm:px-5 sm:py-3.5 border-b ${
          isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50/50'
        } flex flex-col md:flex-row md:items-center justify-between gap-3.5 transition-colors`}>
          {/* Left: Card Title & Subtitle */}
          <div className="min-w-0 flex-1 mr-4">
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'} whitespace-nowrap`}>
              {cardTitle}
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
              {cardSubtitle}
            </p>
          </div>

          {/* Right: Search + Filters + Refresh */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap justify-start sm:justify-end">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={activeTab === 'issues' ? "Search issues..." : "Search tasks or managers..."}
              className="w-full sm:w-48 md:w-56 shrink-0"
            />

            {/* Status Dropdown */}
            <div className={`h-9 inline-flex items-center gap-2 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            } border rounded-xl px-2.5 text-xs transition-colors shrink-0`}>
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 max-w-[130px] truncate font-medium`}
              >
                <option value="All" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>All Statuses</option>
                {activeTab === 'issues'
                  ? ['Raised','Assigned','Resolved','Closed'].map(s => (
                    <option key={s} value={s} className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>{s}</option>
                  ))
                  : ['Pending Acceptance','Assigned','Accepted','In Progress','Completed','Closed','Suspend Requested','Suspended','Rework Required'].map(s => (
                    <option key={s} value={s} className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>{s}</option>
                  ))
                }
              </select>
            </div>

            {/* Priority Dropdown */}
            <div className={`h-9 inline-flex items-center gap-2 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            } border rounded-xl px-2.5 text-xs transition-colors shrink-0`}>
              <Flag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className={`bg-transparent border-none ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs focus:outline-none cursor-pointer pr-1 max-w-[120px] truncate font-medium`}
              >
                <option value="All" className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>All Priorities</option>
                {PRIORITIES.map(p => (
                  <option key={p} value={p} className={isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>{p}</option>
                ))}
              </select>
            </div>

            {/* Refresh button */}
            <button
              type="button"
              onClick={() => { loadIssues(); if(roleGroup !== 'qc') loadTasks(); }}
              title="Refresh Data"
              className={`h-9 w-9 inline-flex items-center justify-center shrink-0 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              } border rounded-xl transition cursor-pointer`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(loadingIssues || loadingTasks) ? 'animate-spin text-blue-600' : 'text-slate-500 dark:text-slate-400'}`} />
            </button>
          </div>
        </div>

        {/* Table Content */}
        {activeTab === 'issues' && (
          loadingIssues
            ? <div className="p-12 text-center text-slate-500 dark:text-slate-400"><Loader2 size={28} className="animate-spin mx-auto mb-2 text-blue-600" /><div className="text-xs">Loading issues…</div></div>
            : <IssuesTable isDark={isDark} issues={filteredIssues} onView={setViewIssue} onCreateTask={handleCreateTaskFromIssue} isAdmin={roleGroup === 'admin'} onReviewIssue={handleReviewIssue} />
        )}
        {activeTab === 'tasks' && (
          loadingTasks
            ? <div className="p-12 text-center text-slate-500 dark:text-slate-400"><Loader2 size={28} className="animate-spin mx-auto mb-2 text-blue-600" /><div className="text-xs">Loading tasks…</div></div>
            : <TasksTable isDark={isDark} tasks={filteredTasks} onView={setViewTask} onAction={handleQuickAction} roleGroup={roleGroup} isPincodeManager={isPincodeAdmin || (user?.role || '').toLowerCase().includes('pincode')} />
        )}
      </div>

      {/* Workflow Guide (for managers) */}
      {roleGroup === 'manager' && (
        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs font-bold text-blue-600 dark:text-cyan-400 uppercase tracking-wider mb-2">
            Task Workflow Guide
          </div>
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600 dark:text-slate-400">
            {[['High Priority', 'Assigned → Start Work → Complete'], ['Medium/Low', 'Assigned → Accept → Start Work → Complete'], ['Any (if stuck)', 'In Progress → Suspend Request → Admin Review']].map(([label, flow]) => (
              <div key={label} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <strong className="text-slate-800 dark:text-slate-200">{label}:</strong> <span>{flow}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {raiseIssueOpen && <RaiseIssueModal isDark={isDark} onClose={() => setRaiseIssueOpen(false)} onSuccess={(msg) => { showToast('success', msg); loadIssues(); }} />}
      {createTaskOpen && <CreateTaskModal isDark={isDark} onClose={() => { setCreateTaskOpen(false); setLinkedIssue(null); }} linkedIssue={linkedIssue} onSuccess={(msg) => { showToast('success', msg); loadTasks(); loadIssues(); }} />}
      {viewIssue && (
        <IssueDetailModal
          issue={viewIssue}
          isDark={isDark}
          onClose={() => setViewIssue(null)}
          onCreateTask={roleGroup === 'admin' ? handleCreateTaskFromIssue : null}
          onReview={handleReviewIssue}
          tasks={tasks}
          isAdmin={roleGroup === 'admin'}
        />
      )}
      {viewTask && (
        <TaskDetailModal
          task={viewTask}
          isDark={isDark}
          onClose={() => setViewTask(null)}
          onReview={handleReviewTask}
          isAdmin={roleGroup === 'admin'}
        />
      )}
      {completeModal && <CompleteTaskModal task={completeModal} isDark={isDark} onClose={() => setCompleteModal(null)} onSuccess={(msg) => { showToast('success', msg); loadTasks(); }} />}
      {suspendModal && <SuspendModal task={suspendModal} isDark={isDark} onClose={() => setSuspendModal(null)} onSuccess={(msg) => { showToast('success', msg); loadTasks(); }} />}
      {suspendReviewModal && <SuspendReviewModal task={suspendReviewModal} isDark={isDark} onClose={() => setSuspendReviewModal(null)} onSuccess={(msg) => { showToast('success', msg); loadTasks(); }} />}

      <Toast toast={toast} />
    </div>
  );
}

export default QCTaskModule;
