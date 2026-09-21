import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { ResumeModal } from '../../components/ResumeModal';
import { JobApplicationDetailsModal } from '../../components/JobApplicationDetailsModal';
import { useTheme } from '../../context/ThemeContext';
import { FileText, MapPin, Building2, Briefcase, UserCheck, Award, XCircle, Code2, Wrench } from 'lucide-react';

export function StateJobs() {
  const { isDark } = useTheme();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getJobs();
      if (res.success) setJobs(res.jobs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to identify IT vs Non-IT Job Applications
  const isItJob = (job) => {
    if (job.category) {
      return job.category.toLowerCase() === 'it';
    }
    const itKeywords = ['developer', 'software', 'engineer', 'it', 'web', 'data', 'cloud', 'cyber', 'frontend', 'backend', 'fullstack', 'qa', 'network', 'devops', 'tech'];
    const title = (job.jobTitle || job.title || '').toLowerCase();
    const skills = Array.isArray(job.skills) ? job.skills.join(' ').toLowerCase() : '';
    return itKeywords.some(k => title.includes(k) || skills.includes(k));
  };

  // Compute 6 KPI stats for 2 rows
  const kpiStats = useMemo(() => {
    const total = jobs.length;
    const shortlisted = jobs.filter(j => (j.status || '').toLowerCase().includes('shortlist')).length;
    const selected = jobs.filter(j => {
      const s = (j.status || '').toLowerCase();
      return s.includes('selected') || s.includes('offer') || s.includes('hired');
    }).length;
    const rejected = jobs.filter(j => (j.status || '').toLowerCase().includes('reject')).length;
    const itJobs = jobs.filter(j => isItJob(j)).length;
    const nonItJobs = total - itJobs;

    return {
      total,
      shortlisted,
      selected,
      rejected,
      itJobs,
      nonItJobs
    };
  }, [jobs]);

  const columns = [
    {
      header: 'Customer',
      accessor: (row) => `${row.customerName} ${row.id}`,
      render: (row) => (
        <div className="whitespace-nowrap">
          <div className="font-bold text-slate-900 dark:text-white text-sm">
            {row.customerName}
          </div>
          <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
            App ID: {row.id}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {row.applicationDate || row.createdAt || '2026-03-05 10:30 AM'}
          </div>
        </div>
      )
    },
    {
      header: 'Job Title',
      accessor: (row) => `${row.jobTitle || row.title} ${row.vendorName || ''}`,
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white text-xs">
            {row.jobTitle || row.title}
          </div>
          {row.vendorName && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{row.vendorName}</span>
            </div>
          )}
          {row.jobType && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {row.jobType}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Location',
      accessor: 'pincode',
      render: (row) => (
        <div className="text-xs whitespace-nowrap">
          <div className="font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>PIN: {row.pincode}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 pl-4">
            {row.district || '-'}{row.division ? ` / ${row.division}` : ''}
          </div>
        </div>
      )
    },
    {
      header: 'Resume',
      className: 'whitespace-nowrap min-w-[130px]',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedApplication(row);
            setShowResumeModal(true);
          }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
          } border transition shadow-sm cursor-pointer`}
          title="View Candidate Application Resume"
        >
          <FileText className="w-3.5 h-3.5 text-blue-500" />
          <span>View Resume</span>
        </button>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      className: 'whitespace-nowrap min-w-[120px]',
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Customer Job Applications</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Customer applications submitted for vendor-posted job openings across the state.</p>
      </div>

      {/* 6 KPI Cards in 2 rows (3 columns on md+ screens) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
        {/* Row 1, Card 1: Total Applications */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Applications</span>
            <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.total.toLocaleString()}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
            Active candidate pool
          </div>
        </div>

        {/* Row 1, Card 2: Shortlisted */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Shortlisted</span>
            <UserCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.shortlisted.toLocaleString()}
          </div>
          <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium mt-0.5">
            Qualified for evaluation
          </div>
        </div>

        {/* Row 1, Card 3: Selected */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Selected</span>
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.selected.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Offer released & hired
          </div>
        </div>

        {/* Row 2, Card 4: Rejected */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rejected</span>
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.rejected.toLocaleString()}
          </div>
          <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
            Unsuccessful submissions
          </div>
        </div>

        {/* Row 2, Card 5: IT Jobs */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">IT Jobs</span>
            <Code2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.itJobs.toLocaleString()}
          </div>
          <div className="text-[10px] text-violet-600 dark:text-violet-400 font-medium mt-0.5">
            Tech & Engineering roles
          </div>
        </div>

        {/* Row 2, Card 6: Non-IT Jobs */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Non-IT Jobs</span>
            <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.nonItJobs.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            Operations & Services roles
          </div>
        </div>
      </div>

      <DataTable
        title="Job Applications"
        subtitle="Candidate applications submitted for vendor job vacancies"
        columns={columns}
        data={jobs}
        loading={loading}
        onRefresh={loadData}
        onRowClick={(row) => {
          setSelectedApplication(row);
          setShowDetailsModal(true);
        }}
        searchPlaceholder="Search candidate, job title, or PIN..."
        exportFileName="job_applications.csv"
      />

      {/* Full Job Application Details Modal (Row Click) */}
      <JobApplicationDetailsModal
        application={selectedApplication}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        onViewResume={(app) => {
          setSelectedApplication(app);
          setShowDetailsModal(false);
          setShowResumeModal(true);
        }}
      />

      {/* Dedicated PDF Resume Viewer Modal (Resume Button Click) */}
      <ResumeModal
        application={selectedApplication}
        isOpen={showResumeModal}
        onClose={() => setShowResumeModal(false)}
      />
    </div>
  );
}
